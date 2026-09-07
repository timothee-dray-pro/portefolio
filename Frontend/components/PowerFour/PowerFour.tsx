import { useEffect, useState } from "react";
import styles from "../../styles/PowerFour.module.css";
import Board from "./Board";
import { usePowerFourStore } from "../../Data/PowerFourStore";
import GetIaMove from "./ai";
import { getDropRow } from "./engine";
import {
  connect,
  createRoomNetwork,
  disconnect,
  joinRoomNetwork,
  leaveRoomNetwork,
  chooseColorNetwork,
  startGameNetwork,
  finishGameNetwork,
  playMoveNetwork,
} from "./networkClient";

// Hex d'une couleur (1 = jaune, 2 = rouge)
const colorHex = (color: number) => (color === 1 ? "#f5c518" : "#e5484d");

function PowerFour() {
  const [screen, setScreen] = useState<string>("menu");

  // Réglages du mode IA (state local, pas dans le store)
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [playerColor, setPlayerColor] = useState<number>(1);

  // Navigation du mode en ligne
  const [onlineView, setOnlineView] = useState<string>("lobby");
  const [roomCode, setRoomCode] = useState<string>(""); // code saisi pour rejoindre
  const [currentRoomCode, setCurrentRoomCode] = useState<string>(""); // code de la room où l'on est
  const [errorMessage, setErrorMessage] = useState<string>(""); // erreur affichée dans le lobby

  const setMe = usePowerFourStore((state) => state.setMe);
  const resetGame = usePowerFourStore((state) => state.resetGame);
  const playMove = usePowerFourStore((state) => state.playMove);
  const setStatut = usePowerFourStore((state) => state.setStatut);
  const setNbOfPlayer = usePowerFourStore((state) => state.setNbOfPlayer);

  const currentPlayer = usePowerFourStore((state) => state.currentPlayer);
  const statut = usePowerFourStore((state) => state.statut);
  const winner = usePowerFourStore((state) => state.winner);
  const me = usePowerFourStore((state) => state.me);
  const grid = usePowerFourStore((state) => state.grid);
  const nbOfPlayer = usePowerFourStore((state) => state.nbOfPlayer);
  const role = usePowerFourStore((state) => state.role);

  // Tour de l'IA : quand ce n'est pas à moi de jouer et que la partie tourne.
  // Le timer est nettoyé si l'état change entre-temps (évite un coup fantôme
  // si le joueur quitte l'écran pendant la "réflexion" de l'IA).
  useEffect(() => {
    if (currentPlayer !== me && screen === "ai" && statut === "playing") {
      const timer = setTimeout(() => {
        const aiMove = GetIaMove(difficulty, currentPlayer, grid);
        playMove(aiMove, currentPlayer);
      }, 100); // léger délai pour l'IA

      return () => {
        clearTimeout(timer);
      };
    }
  }, [currentPlayer, screen, statut, difficulty, me, grid]);

  // Connexion au serveur : connecté tant qu'on est en mode online, déconnecté sinon.
  // À l'entrée du mode online, on part de 0 joueur (rempli par les messages serveur).
  useEffect(() => {
    if (screen === "online") {
      setNbOfPlayer(0);
      setStatut("waiting");
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [screen]);

  // Fin de partie en ligne : on prévient le serveur pour qu'il repasse la room
  // en "ready" (il ne suit pas la grille, donc il ne peut pas le détecter seul).
  // Idempotent côté serveur : pas de souci si les deux joueurs l'envoient.
  useEffect(() => {
    if (screen === "online" && (statut === "win" || statut === "draw")) {
      finishGameNetwork();
    }
  }, [screen, statut]);

  // Crée un salon : le rôle et le nb de joueurs sont écrits dans le store par le réseau.
  const createRoom = async () => {
    setErrorMessage("");
    const data = await createRoomNetwork();

    if (!data.result) {
      setErrorMessage(data.reason ?? "Impossible de créer le salon");
      return;
    }

    setCurrentRoomCode(data.roomId ?? "");
    setOnlineView("room");
  };

  // Rejoint un salon existant via son code.
  const joinRoom = async () => {
    if (roomCode === "") return;

    setErrorMessage("");
    const data = await joinRoomNetwork(roomCode);

    if (!data.result) {
      setErrorMessage(data.reason ?? "Impossible de rejoindre le salon");
      return;
    }

    setCurrentRoomCode(roomCode);
    setOnlineView("room");
  };

  // Quitte le salon (prévient le serveur) et revient au lobby.
  const leaveRoom = () => {
    leaveRoomNetwork();
    setNbOfPlayer(0);
    setStatut("waiting");
    setOnlineView("lobby");
    setRoomCode("");
    setCurrentRoomCode("");
    setErrorMessage("");
  };

  // ============================================================
  // Écran de jeu partagé (local, IA, online).
  // En online, on y reste pendant la partie ET une fois finie (win/draw)
  // pour afficher l'écran de fin ; le retour au salon se fait quand le
  // statut repasse à waiting/ready (départ d'un joueur, retour volontaire...).
  // ============================================================
  const isPlayingScreen =
    screen === "local" ||
    screen === "ai" ||
    (screen === "online" &&
      (statut === "playing" || statut === "win" || statut === "draw"));

  if (isPlayingScreen) {
    const isOver = statut === "win" || statut === "draw";
    const winnerColor = winner === 1 ? "Jaune" : "Rouge";
    const winnerHex = colorHex(winner ?? 1);
    const currentHex = colorHex(currentPlayer);

    // En IA et en online, on ne joue que pendant son propre tour.
    const isMyTurn = currentPlayer === me;
    const restrictToMe = screen === "ai" || screen === "online";

    // Texte de l'indicateur de tour, selon le mode.
    let turnText: string;
    if (screen === "ai") {
      turnText = isMyTurn ? "À toi de jouer" : "L'ordinateur réfléchit…";
    } else if (screen === "online") {
      turnText = isMyTurn ? "À toi de jouer" : "À l'adversaire de jouer";
    } else {
      turnText = currentPlayer === 1 ? "Au tour du Jaune" : "Au tour du Rouge";
    }

    return (
      <div className={styles.gameContainer}>
        {/* Indicateur de tour (masqué quand la partie est finie) */}
        <div
          className={styles.turnIndicator}
          style={{ visibility: isOver ? "hidden" : "visible" }}
        >
          <span className={styles.turnDot} style={{ background: currentHex }} />
          <span className={styles.turnText}>{turnText}</span>
        </div>

        <div className={styles.boardWrapper}>
          <Board
            onColumnClick={(col) => {
              // Hors de son tour : on ignore (IA et online).
              if (restrictToMe && !isMyTurn) return;

              if (screen === "online") {
                // Online : on valide la jouabilité du coup côté client
                // (colonne non pleine), puis on l'envoie au serveur qui
                // fait autorité. Le coup s'appliquera au retour du message "move".
                if (getDropRow(grid, col) === null) return;
                playMoveNetwork(col);
              } else {
                // Local / IA : application directe dans le store.
                playMove(col, currentPlayer);
              }
            }}
          />

          {isOver && (
            <div className={styles.overlay}>
              <div className={styles.overlayContent}>
                {statut === "win" ? (
                  <p
                    className={styles.overlayTitle}
                    style={{ color: winnerHex }}
                  >
                    {winnerColor} gagne !
                  </p>
                ) : (
                  <p className={styles.overlayTitle}>Match nul</p>
                )}

                {screen === "online" ? (
                  <>
                    {role === "admin" ? (
                      // En ligne, seul l'admin relance : le serveur remet le
                      // tour à zéro et rediffuse "playing" aux deux joueurs.
                      <button
                        className={styles.replayButton}
                        onClick={() => startGameNetwork()}
                      >
                        Rejouer
                      </button>
                    ) : (
                      <p className={styles.note}>
                        En attente que l'hôte relance la partie…
                      </p>
                    )}

                    <div className={styles.configActions}>
                      {/* Retour au salon : on reste dans la room (statut
                          "ready" = room complète), l'écran salon reprend */}
                      <button
                        className={styles.backButton}
                        onClick={() => setStatut("ready")}
                      >
                        Retour au salon
                      </button>
                      {/* Quitter la partie : on sort de la room et on
                          revient au lobby (l'adversaire est prévenu) */}
                      <button className={styles.backButton} onClick={leaveRoom}>
                        Quitter la partie
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    className={styles.replayButton}
                    onClick={() => {
                      resetGame();
                      setStatut("playing"); // on relance directement
                    }}
                  >
                    Rejouer
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // Mode en ligne : salon (lobby + salle)
  // ============================================================
  if (screen === "online") {
    // ---------- Salle : liste des joueurs + choix couleur + jouer ----------
    if (onlineView === "room") {
      // Ma couleur vient du store (me) ; l'adversaire prend l'inverse.
      const myColor = me ?? 1;
      const opponentColor = myColor === 1 ? 2 : 1;
      const isAdmin = role === "admin";
      const isReady = statut === "ready";

      return (
        <div className={styles.menu}>
          <h1 className={styles.title}>Salon</h1>
          <p className={styles.subtitle}>
            Code de la partie : {currentRoomCode}
          </p>

          <div className={styles.configGroup}>
            <p className={styles.groupLabel}>Joueurs</p>
            <div className={styles.playerList}>
              {/* Moi : toujours présent */}
              <div className={styles.playerSlot}>
                <span className={styles.playerSlotLabel}>Moi</span>
                <span className={styles.playerName}>
                  <span
                    className={styles.dot}
                    style={{ background: colorHex(myColor) }}
                  />
                  Moi
                </span>
              </div>

              {/* Adversaire : présent seulement s'il y a 2 joueurs */}
              <div className={styles.playerSlot}>
                <span className={styles.playerSlotLabel}>Adversaire</span>
                {nbOfPlayer >= 2 ? (
                  <span className={styles.playerName}>
                    <span
                      className={styles.dot}
                      style={{ background: colorHex(opponentColor) }}
                    />
                    Adversaire
                  </span>
                ) : (
                  <span className={styles.playerEmpty}>En attente…</span>
                )}
              </div>
            </div>
          </div>

          {/* Choix de la couleur : admin seulement. Envoie au serveur, qui
              diffuse aux deux joueurs (met à jour "me" via le réseau). */}
          {isAdmin && (
            <div className={styles.configGroup}>
              <p className={styles.groupLabel}>Ma couleur</p>
              <div className={styles.optionRow}>
                <button
                  className={`${styles.colorOption} ${myColor === 1 ? styles.colorActive : ""}`}
                  onClick={() => chooseColorNetwork(1)}
                >
                  <span
                    className={styles.dot}
                    style={{ background: "#f5c518" }}
                  />
                  Jaune
                </button>
                <button
                  className={`${styles.colorOption} ${myColor === 2 ? styles.colorActive : ""}`}
                  onClick={() => chooseColorNetwork(2)}
                >
                  <span
                    className={styles.dot}
                    style={{ background: "#e5484d" }}
                  />
                  Rouge
                </button>
              </div>
            </div>
          )}

          <div className={styles.configActions}>
            <button className={styles.backButton} onClick={leaveRoom}>
              Quitter
            </button>
            {/* Jouer : admin seulement, cliquable une fois la room prête (2 joueurs) */}
            {isAdmin && isReady && (
              <button
                className={styles.playButton}
                onClick={() => startGameNetwork()}
              >
                Jouer
              </button>
            )}
          </div>
        </div>
      );
    }

    // ---------- Lobby : créer ou rejoindre ----------
    return (
      <div className={styles.menu}>
        <h1 className={styles.title}>En ligne</h1>
        <p className={styles.subtitle}>Crée ou rejoins une partie</p>

        <div className={styles.buttons}>
          {/* Créer un salon */}
          <button className={styles.modeButton} onClick={createRoom}>
            <span className={styles.modeLabel}>Créer un salon</span>
            <span className={styles.modeHint}>tu seras l'hôte</span>
          </button>

          {/* Rejoindre un salon */}
          <div className={styles.configGroup}>
            <p className={styles.groupLabel}>Rejoindre un salon</p>
            <div className={styles.optionRow}>
              <input
                className={styles.codeInput}
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value)}
                placeholder="Code de la partie"
                onKeyDown={(event) => {
                  if (event.key === "Enter") joinRoom();
                }}
              />
              <button className={styles.playButton} onClick={joinRoom}>
                Rejoindre
              </button>
            </div>
          </div>
        </div>

        <div className={styles.configActions}>
          <button
            className={styles.backButton}
            onClick={() => setScreen("menu")}
          >
            Retour
          </button>
        </div>

        {/* Message d'erreur éventuel, en gris en bas */}
        {errorMessage !== "" && (
          <p className={styles.errorMessage}>{errorMessage}</p>
        )}
      </div>
    );
  }

  // ============================================================
  // Sous-menu de configuration du mode IA
  // ============================================================
  if (screen === "aiConfig") {
    return (
      <div className={styles.menu}>
        <h1 className={styles.title}>Contre l'ordinateur</h1>
        <p className={styles.subtitle}>Configure ta partie</p>

        {/* Choix de la difficulté */}
        <div className={styles.configGroup}>
          <p className={styles.groupLabel}>Difficulté</p>
          <div className={styles.optionRow}>
            <button
              className={`${styles.option} ${difficulty === "easy" ? styles.optionActive : ""}`}
              onClick={() => setDifficulty("easy")}
            >
              Facile
            </button>
            <button
              className={`${styles.option} ${difficulty === "medium" ? styles.optionActive : ""}`}
              onClick={() => setDifficulty("medium")}
            >
              Intermédiaire
            </button>
            <button
              className={`${styles.option} ${difficulty === "hard" ? styles.optionActive : ""}`}
              onClick={() => setDifficulty("hard")}
            >
              Difficile
            </button>
          </div>
        </div>

        {/* Choix de la couleur */}
        <div className={styles.configGroup}>
          <p className={styles.groupLabel}>Ta couleur</p>
          <div className={styles.optionRow}>
            <button
              className={`${styles.colorOption} ${playerColor === 1 ? styles.colorActive : ""}`}
              onClick={() => setPlayerColor(1)}
            >
              <span className={styles.dot} style={{ background: "#f5c518" }} />
              Jaune
            </button>
            <button
              className={`${styles.colorOption} ${playerColor === 2 ? styles.colorActive : ""}`}
              onClick={() => setPlayerColor(2)}
            >
              <span className={styles.dot} style={{ background: "#e5484d" }} />
              Rouge
            </button>
          </div>
          {playerColor === 2 && (
            <p className={styles.note}>
              Le jaune commence : l'ordinateur jouera en premier.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className={styles.configActions}>
          <button
            className={styles.backButton}
            onClick={() => setScreen("menu")}
          >
            Retour
          </button>
          <button
            className={styles.playButton}
            onClick={() => {
              resetGame();
              setMe(playerColor); // le joueur humain est de cette couleur
              setStatut("playing"); // on lance directement la partie
              setScreen("ai");
            }}
          >
            Jouer
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // Écran de choix des modes
  // ============================================================
  return (
    <div className={styles.menu}>
      <h1 className={styles.title}>Puissance 4</h1>
      <p className={styles.subtitle}>Choisis un mode de jeu</p>

      <div className={styles.buttons}>
        <button
          className={styles.modeButton}
          onClick={() => {
            resetGame();
            setMe(1);
            setStatut("playing"); // local : la partie démarre tout de suite
            setScreen("local");
          }}
        >
          <span className={styles.modeLabel}>2 joueurs</span>
          <span className={styles.modeHint}>en local, sur cet appareil</span>
        </button>

        <button
          className={styles.modeButton}
          onClick={() => setScreen("aiConfig")}
        >
          <span className={styles.modeLabel}>Contre l'ordinateur</span>
          <span className={styles.modeHint}>affronte l'IA</span>
        </button>

        <button
          className={styles.modeButton}
          onClick={() => {
            setOnlineView("lobby");
            setScreen("online");
          }}
        >
          <span className={styles.modeLabel}>En ligne</span>
          <span className={styles.modeHint}>contre un autre joueur</span>
        </button>
      </div>
    </div>
  );
}

export default PowerFour;
