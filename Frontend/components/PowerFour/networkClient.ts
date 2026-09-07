import { usePowerFourStore } from "../../Data/PowerFourStore";

let socket: WebSocket | null = null;

// Délai maximum d'attente d'une réponse du serveur pour les requêtes
// de type requête/réponse (create, join) avant d'abandonner proprement.
const RESPONSE_TIMEOUT_MS = 5000;

export function connect() {
  if (socket !== null) return; // déjà connecté, on ne recrée rien

  socket = new WebSocket("ws://localhost:8765");

  socket.onopen = () => {};

  // Routage des messages non sollicités du serveur (arrivent à tout moment).
  // Les réponses aux requêtes create/join sont gérées séparément via leurs
  // propres écouteurs temporaires (voir createRoomNetwork / joinRoomNetwork).
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const store = usePowerFourStore.getState();

    switch (data.type) {
      case "userJoined":
        // Un second joueur a rejoint : on est maintenant 2.
        store.setNbOfPlayer(2);
        break;

      case "userLeft":
        // L'adversaire est parti : on repasse à 1 et on revient au salon
        // (le statut "waiting" fait sortir de l'écran de jeu si une partie
        // était en cours).
        store.setNbOfPlayer(1);
        store.setStatut("waiting");
        break;

      case "adminLeft":
        // L'admin est parti : on devient admin, il ne reste qu'un joueur,
        // et on revient au salon si une partie était en cours.
        store.setRole("admin");
        store.setNbOfPlayer(1);
        store.setStatut("waiting");
        break;

      case "ready":
        // La room est complète : passage en "ready".
        store.setStatut("ready");
        break;

      case "playing":
        // Le serveur (re)lance une partie : plateau vierge, jaune commence.
        store.resetGrid();
        store.setStatut("playing");
        break;

      case "color":
        // Attribution des couleurs : chacun prend la sienne selon son rôle.
        if (usePowerFourStore.getState().role === "admin") {
          store.setMe(data.adminColor);
        } else {
          store.setMe(data.userColor);
        }
        break;

      case "move":
        // Le serveur a validé et diffusé un coup : on l'applique localement.
        // data.color = couleur du joueur qui a joué (le serveur fait autorité).
        store.playMove(data.column, data.color);
        break;

      default:
        break;
    }
  };

  socket.onclose = () => {
    socket = null;
  };
}

export function disconnect() {
  socket?.close();
  socket = null;
}

// Fabrique une requête de type requête/réponse : envoie le payload et attend
// LA réponse du serveur (le premier message portant "result" qui n'est pas
// le message de bienvenue). Timeout au bout de RESPONSE_TIMEOUT_MS pour ne
// jamais laisser une Promise (et son écouteur) pendre indéfiniment.
function sendRequest(payload: unknown): Promise<any> {
  return new Promise((resolve) => {
    if (socket === null) {
      resolve({ result: false, reason: "Pas de connexion au serveur" });
      return;
    }

    const currentSocket = socket;

    const cleanup = () => {
      currentSocket.removeEventListener("message", handleResponse);
      clearTimeout(timer);
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve({ result: false, reason: "Le serveur ne répond pas" });
    }, RESPONSE_TIMEOUT_MS);

    const handleResponse = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      // On ne consomme QUE la réponse à cette requête : elle porte "result"
      // et n'est pas le message de bienvenue (qui porte "userId"). Les
      // messages non sollicités (ready, color...) filent au onmessage général.
      if (data.result === undefined) return;
      if (data.userId !== undefined) return;

      cleanup();
      resolve(data);
    };

    currentSocket.addEventListener("message", handleResponse);
    currentSocket.send(JSON.stringify(payload));
  });
}

export function createRoomNetwork(): Promise<{
  result: boolean;
  role?: string;
  roomId?: string;
  room?: { players: Record<string, string> };
  reason?: string;
}> {
  return sendRequest({
    type: "room",
    room: { type: "create", id: null },
  }).then((data) => {
    if (data.result && data.room?.players) {
      const nbOfPlayer = Object.keys(data.room.players).length;
      usePowerFourStore.getState().setNbOfPlayer(nbOfPlayer);
      usePowerFourStore.getState().setRole(data.role);
    }

    return data;
  });
}

export function joinRoomNetwork(id: string): Promise<{
  result: boolean;
  role?: string;
  room?: { players: Record<string, string> };
  reason?: string;
}> {
  return sendRequest({
    type: "room",
    room: { type: "join", id: id },
  }).then((data) => {
    if (data.result && data.room?.players) {
      const nbOfPlayer = Object.keys(data.room.players).length;
      usePowerFourStore.getState().setNbOfPlayer(nbOfPlayer);
      usePowerFourStore.getState().setRole(data.role);
    }

    return data;
  });
}

export function leaveRoomNetwork(): void {
  socket?.send(
    JSON.stringify({ type: "room", room: { type: "leave", id: null } }),
  );
}

// L'admin choisit sa couleur ; le serveur déduit celle de l'adversaire,
// la stocke et diffuse l'attribution aux deux joueurs.
export function chooseColorNetwork(color: number): void {
  socket?.send(
    JSON.stringify({
      type: "room",
      room: { type: "color", id: null, color: color },
    }),
  );
}

// L'admin lance OU relance la partie ; le serveur remet le tour à zéro,
// passe la room en "playing" et prévient les deux joueurs (qui vident
// leur plateau en recevant "playing").
export function startGameNetwork(): void {
  socket?.send(JSON.stringify({ type: "game", instruction: "start" }));
}

// Prévient le serveur que la partie est terminée (win/draw détecté côté
// client) : la room repasse en "ready" pour permettre couleurs et relance.
// Idempotent : les deux joueurs peuvent l'envoyer sans effet de bord.
export function finishGameNetwork(): void {
  socket?.send(JSON.stringify({ type: "game", instruction: "finished" }));
}

// Envoie un coup (numéro de colonne) au serveur. Le serveur valide le tour,
// puis diffuse le coup aux deux joueurs qui l'appliquent via le message "move".
export function playMoveNetwork(column: number): void {
  socket?.send(
    JSON.stringify({ type: "game", instruction: "move", column: column }),
  );
}
