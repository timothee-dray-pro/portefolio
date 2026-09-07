import asyncio
import websockets
import uuid
import json

users = []
rooms = []


async def sendMessage(userId, message):
    client = getClientOfUserId(userId)

    # Le client peut avoir disparu entre-temps (déconnexion brutale) :
    # on n'envoie que si on l'a retrouvé, sans faire planter le handler.
    if client == "":
        return

    try:
        await client.send(message)
    except websockets.exceptions.ConnectionClosed:
        pass


# Envoie un même message aux deux joueurs d'une room (s'ils existent).
async def broadcastToRoom(room, message):
    adminId = room["players"].get("admin")
    memberId = room["players"].get("user")

    if adminId is not None:
        await sendMessage(adminId, message)

    if memberId is not None:
        await sendMessage(memberId, message)


def getUserIdOfClient(client):
    result = ""

    for user in users:
        if user["client"] == client:
            result = user["id"]

    return result


def getClientOfUserId(userId):
    result = ""

    for user in users:
        if user["id"] == userId:
            result = user["client"]

    return result


# Renvoie la room contenant ce joueur (admin OU user), ou None s'il n'est dans aucune.
# Utilitaire central pour retrouver la room d'un userId sans redupliquer la boucle.
def getRoomOfUser(userId):
    result = None

    for room in rooms:
        if userId in room["players"].values():
            result = room

    return result


# Gère le départ d'un joueur d'une room (déconnexion OU leave volontaire) :
# promotion de l'admin, retour en "waiting", notification de l'autre joueur,
# suppression de la room si elle devient vide.
# Ne touche PAS à la liste users (le joueur peut rester connecté).
async def handlePlayerLeaving(userId):
    global rooms

    remainingRooms = []

    for room in rooms:
        players = room["players"]

        if players.get("admin") == userId:

            if "user" in players:
                newAdminId = players["user"]

                room["players"] = {
                    "admin": newAdminId
                }

                room["status"] = "waiting"
                room["turn"] = 1
                # Le promu garde la couleur qu'il avait en tant que user :
                # on bascule les couleurs stockées pour rester cohérent.
                room["adminColor"] = room["userColor"]
                room["userColor"] = 2 if room["adminColor"] == 1 else 1

                await sendMessage(
                    newAdminId,
                    json.dumps({
                        "type": "adminLeft",
                        "role": "admin",
                        "message": "L'admin a quitté la partie, tu es maintenant admin",
                    })
                )

                remainingRooms.append(room)

        elif players.get("user") == userId:

            adminId = players.get("admin")

            room["players"] = {
                "admin": adminId
            }

            room["status"] = "waiting"
            room["turn"] = 1

            if adminId is not None:
                await sendMessage(
                    adminId,
                    json.dumps({
                        "type": "userLeft",
                        "message": "L'autre joueur a quitté la partie",
                    })
                )

            remainingRooms.append(room)

        else:
            remainingRooms.append(room)

    rooms[:] = remainingRooms


# Retire un joueur suite à une déconnexion : on le sort de la room
# (via handlePlayerLeaving) PUIS de la liste des users connectés.
async def removeUser(userId):
    global users

    await handlePlayerLeaving(userId)

    users[:] = [
        user for user in users
        if user["id"] != userId
    ]


async def handler(client):
    print("Client connecté")

    userId = str(uuid.uuid4())

    users.append({
        "client": client,
        "id": userId,
    })

    await sendMessage(
        userId,
        json.dumps({
            "result": True,
            "userId": userId
        })
    )

    try:
        async for message in client:
            # Un message non-JSON ne doit pas faire tomber la connexion serveur.
            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                await client.close()
                continue

            if "type" not in data:
                await client.close()
                continue

            match data["type"]:

                case "room":

                    if (
                        "room" not in data
                        or "type" not in data["room"]
                        or "id" not in data["room"]
                    ):
                        await client.close()
                        continue

                    room = data["room"]

                    if room["type"] == "create":

                        if len(rooms) > 9999:
                            await sendMessage(
                                userId,
                                json.dumps({
                                    "result": False,
                                    "reason": "Too many rooms already created"
                                })
                            )

                        elif any(
                            userId in existingRoom["players"].values()
                            for existingRoom in rooms
                        ):
                            await sendMessage(
                                userId,
                                json.dumps({
                                    "result": False,
                                    "reason": "Player is already in another room"
                                })
                            )

                        else:
                            code = f"{len(rooms):04d}"

                            newRoom = {
                                "id": code,
                                "players": {
                                    "admin": userId
                                },
                                "status": "waiting",
                                "turn": 1,
                                "adminColor": 1,
                                "userColor": 2
                            }

                            rooms.append(newRoom)

                            await sendMessage(
                                userId,
                                json.dumps({
                                    "role": "admin",
                                    "result": True,
                                    "roomId": code,
                                    "room": newRoom
                                })
                            )

                    elif room["type"] == "join":

                        # Un joueur déjà dans une room ne peut pas en rejoindre une autre.
                        if getRoomOfUser(userId) is not None:
                            await sendMessage(
                                userId,
                                json.dumps({
                                    "result": False,
                                    "reason": "Player is already in another room"
                                })
                            )
                            continue

                        result = False
                        index = 0
                        joinedRoom = None

                        while index < len(rooms) and not result:
                            existingRoom = rooms[index]

                            if (
                                existingRoom["id"] == room["id"]
                                and len(existingRoom["players"]) < 2
                            ):
                                existingRoom["players"]["user"] = userId
                                result = True
                                joinedRoom = existingRoom

                            index += 1

                        if result:
                            await sendMessage(
                                userId,
                                json.dumps({
                                    "role": "user",
                                    "result": True,
                                    "room": joinedRoom
                                })
                            )

                            adminId = joinedRoom["players"].get("admin")

                            if adminId is not None:
                                await sendMessage(
                                    adminId,
                                    json.dumps({
                                        "type": "userJoined",
                                        "message": "Un autre joueur a rejoint la partie",
                                        "room": joinedRoom
                                    })
                                )

                            # La room est complète : passage en "ready" pour les deux.
                            joinedRoom["status"] = "ready"

                            await broadcastToRoom(
                                joinedRoom,
                                json.dumps({"type": "ready"})
                            )

                            # On synchronise immédiatement les couleurs stockées
                            # (par défaut admin=1/user=2, ou le dernier choix de
                            # l'admin) : sans cet envoi, les deux clients
                            # resteraient sur leur couleur locale par défaut.
                            await broadcastToRoom(
                                joinedRoom,
                                json.dumps({
                                    "type": "color",
                                    "adminColor": joinedRoom["adminColor"],
                                    "userColor": joinedRoom["userColor"]
                                })
                            )

                        else:
                            await sendMessage(
                                userId,
                                json.dumps({
                                    "result": False,
                                    "reason": "Room's id doesnt match"
                                })
                            )

                    elif room["type"] == "leave":

                        await handlePlayerLeaving(userId)

                        await sendMessage(
                            userId,
                            json.dumps({
                                "type": "leftRoom",
                                "result": True
                            })
                        )

                    elif room["type"] == "color":

                        # Seul l'admin peut attribuer les couleurs, et uniquement
                        # hors partie (waiting ou ready).
                        currentRoom = getRoomOfUser(userId)

                        if (
                            currentRoom is None
                            or currentRoom["players"].get("admin") != userId
                        ):
                            await sendMessage(
                                userId,
                                json.dumps({
                                    "result": False,
                                    "reason": "Only admin can choose colors"
                                })
                            )
                            continue

                        if currentRoom["status"] == "playing":
                            await sendMessage(
                                userId,
                                json.dumps({
                                    "result": False,
                                    "reason": "Cannot change colors during a game"
                                })
                            )
                            continue

                        # La couleur doit être 1 ou 2, rien d'autre.
                        adminColor = room.get("color")

                        if adminColor not in (1, 2):
                            await sendMessage(
                                userId,
                                json.dumps({
                                    "result": False,
                                    "reason": "Invalid color"
                                })
                            )
                            continue

                        userColor = 2 if adminColor == 1 else 1

                        # On STOCKE les couleurs : le serveur en a besoin pour
                        # valider les tours (savoir qui joue quelle couleur).
                        currentRoom["adminColor"] = adminColor
                        currentRoom["userColor"] = userColor

                        await broadcastToRoom(
                            currentRoom,
                            json.dumps({
                                "type": "color",
                                "adminColor": adminColor,
                                "userColor": userColor
                            })
                        )

                    else:
                        await sendMessage(
                            userId,
                            json.dumps({
                                "result": False
                            })
                        )

                case "game":

                    if "instruction" not in data:
                        await client.close()
                        continue

                    if data["instruction"] == "start":

                        # Seul l'admin peut lancer (ou relancer) la partie,
                        # et seulement si la room est complète.
                        currentRoom = getRoomOfUser(userId)

                        if (
                            currentRoom is None
                            or currentRoom["players"].get("admin") != userId
                        ):
                            await sendMessage(
                                userId,
                                json.dumps({
                                    "result": False,
                                    "reason": "Only admin can start the game"
                                })
                            )
                            continue

                        if len(currentRoom["players"]) < 2:
                            await sendMessage(
                                userId,
                                json.dumps({
                                    "result": False,
                                    "reason": "Room is not full"
                                })
                            )
                            continue

                        currentRoom["status"] = "playing"
                        currentRoom["turn"] = 1  # le jaune (1) commence

                        # "playing" sert aussi de relance : les clients
                        # réinitialisent leur grille en le recevant.
                        await broadcastToRoom(
                            currentRoom,
                            json.dumps({"type": "playing"})
                        )

                    elif data["instruction"] == "finished":

                        # Un client signale la fin de la partie (win/draw détecté
                        # de son côté) : la room repasse en "ready" pour permettre
                        # le changement de couleurs et la relance.
                        # Idempotent : les deux joueurs peuvent l'envoyer.
                        currentRoom = getRoomOfUser(userId)

                        if currentRoom is None:
                            continue

                        if currentRoom["status"] == "playing":
                            currentRoom["status"] = "ready"
                            currentRoom["turn"] = 1

                    elif data["instruction"] == "move":

                        # Un coup = juste un numéro de colonne.
                        currentRoom = getRoomOfUser(userId)

                        if currentRoom is None:
                            continue

                        if currentRoom["status"] != "playing":
                            continue  # pas de coup hors partie

                        # La colonne doit être un entier valide (0 à 6).
                        column = data.get("column")

                        if not isinstance(column, int) or column < 0 or column > 6:
                            continue

                        # Couleur du joueur qui envoie, selon son rôle dans la room.
                        if currentRoom["players"].get("admin") == userId:
                            playerColor = currentRoom["adminColor"]
                        else:
                            playerColor = currentRoom["userColor"]

                        # Validation du TOUR uniquement : la couleur qui joue doit
                        # correspondre au tour courant. (La validité du coup - colonne
                        # jouable - est vérifiée par le client.)
                        if currentRoom["turn"] != playerColor:
                            continue  # pas son tour, on ignore

                        # On alterne le tour et on diffuse le coup aux deux joueurs.
                        currentRoom["turn"] = 2 if playerColor == 1 else 1

                        await broadcastToRoom(
                            currentRoom,
                            json.dumps({
                                "type": "move",
                                "column": column,
                                "color": playerColor
                            })
                        )

                case _:
                    await client.close()

    except websockets.exceptions.ConnectionClosed:
        print("Client déconnecté")

    finally:
        print(
            "Client retiré, clients restants :",
            len(users) - 1
        )

        await removeUser(userId)


async def main():
    try:
        async with websockets.serve(
            handler,
            "localhost",
            8765
        ):
            print("Serveur lancé sur ws://localhost:8765")

            await asyncio.Future()

    except asyncio.CancelledError:
        print("Arrêt du serveur...")


asyncio.run(main())