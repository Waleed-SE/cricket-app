class CricketControl {
  constructor() {
    // Check if Socket.IO is available
    if (typeof io === "undefined") {
      console.error(
        "Socket.IO not loaded! Make sure the Socket.IO script is included."
      );
      alert("Socket.IO library not loaded. Please refresh the page.");
      return;
    }

    this.socket = io();
    this.currentMatch = null;
    this.pendingNewBatter = null; // Track when we need new batter after bowler change
    this.pendingBall = {
      runs: 0,
      isWicket: false,
      extraType: null,
      extraRuns: 0,
    };
    this.initializeSocket();
    this.loadSavedMatches();
    this.setupEventListeners();
  }

  initializeSocket() {
    this.socket.on("connect", () => {
      console.log("Connected to server");
      this.updateConnectionStatus(true);
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from server");
      this.updateConnectionStatus(false);
    });

    this.socket.on("match_created", (matchData) => {
      console.log("Match created event received:", matchData);
      this.currentMatch = matchData;
      this.showMessage("Match created successfully!", "success");
      this.showSection("innings-section");
      this.populatePlayerSelects();
      this.updateUndoButtonState();
    });

    this.socket.on("match_loaded", () => {
      this.showMessage("Match loaded successfully!", "success");
      this.showSection("scoring-section");
    });

    this.socket.on("innings_started", () => {
      this.showMessage("Innings started!", "success");
      this.showSection("scoring-section");
      this.updateUndoButtonState();
    });

    this.socket.on("match_update", (matchData) => {
      console.log(
        "match_update received - isStarted:",
        matchData ? matchData.is_started : "no data",
        "hasOvers:",
        matchData && matchData.overs ? matchData.overs.length : 0
      );
      this.currentMatch = matchData;
      this.updateMatchDisplay();
      this.updateUndoButtonState();

      // Populate player selects if they're empty (happens when loading from file)
      const newBowlerSelect = document.getElementById("new-bowler-select");
      if (newBowlerSelect && newBowlerSelect.children.length <= 1) {
        // Only has the default "Select Player" option, so populate the dropdowns
        this.populatePlayerSelects();
      }
    });

    this.socket.on("ball_added", (result) => {
      this.resetBallInput();
      this.updateUndoButtonState();

      if (result.action === "match_complete") {
        this.handleMatchComplete(result);
      } else if (result.action === "innings_complete") {
        this.handleInningsComplete(result);
      } else if (result.action === "wicket") {
        this.showNewBatterModal();
      } else if (result.action === "over_complete") {
        if (result.wicket) {
          // Over complete with wicket - prioritize new bowler, but also need new batter
          this.showNewBowlerModal();
          // Store that we need a new batter after bowler is set
          this.pendingNewBatter = result.dismissed;
        } else {
          // Just over complete
          this.showNewBowlerModal();
        }
      }

      if (result.action !== "match_complete") {
        this.showMessage("Ball added successfully!", "success");
      }
    });

    this.socket.on("bowler_set", () => {
      this.closeModal("new-bowler-modal");
      this.showMessage("New bowler set!", "success");

      // Check if we need to show new batter modal (wicket occurred on last ball of over)
      if (this.pendingNewBatter) {
        this.showNewBatterModal();
        this.pendingNewBatter = null; // Clear the pending state
      }
    });

    this.socket.on("batter_set", () => {
      this.closeModal("new-batter-modal");
      this.showMessage("New batter set!", "success");
    });

    this.socket.on("second_innings_started", () => {
      this.closeModal("second-innings-modal");
      this.showMessage("Second innings started!", "success");
      this.showSection("scoring-section");
    });

    this.socket.on("error", (error) => {
      console.error("Socket error received:", error);
      this.showMessage(error.message, "error");
    });

    this.socket.on("ball_undone", (result) => {
      console.log("Ball undone:", result);
      this.showMessage("Last ball undone successfully", "success");
      this.resetBallInput();
      this.updateUndoButtonState();
    });
  }

  handleMatchComplete(result) {
    this.showMessage(`Match Complete! ${result.match_result}`, "success");
    this.showSection("match-complete-section");

    // Display the match result in the proper cricket format
    const winnerDisplay = document.getElementById("winner-display");
    const finalScores = document.getElementById("final-scores");

    if (winnerDisplay) {
      winnerDisplay.innerHTML = `<h3>${result.match_result}</h3>`;
    }

    if (finalScores && this.currentMatch) {
      const team1Score = `${this.currentMatch.team1.name}: ${this.currentMatch.team1.runs}/${this.currentMatch.team1.wickets}`;
      const team2Score = `${this.currentMatch.team2.name}: ${this.currentMatch.team2.runs}/${this.currentMatch.team2.wickets}`;
      finalScores.innerHTML = `
        <div class="final-score-line">${team1Score}</div>
        <div class="final-score-line">${team2Score}</div>
      `;
    }

    // Disable ball input if it exists
    const ballInputSection = document.getElementById("ball-input-section");
    if (ballInputSection) {
      ballInputSection.style.display = "none";
    }
  }

  handleInningsComplete(result) {
    if (result.new_innings === 2) {
      this.showMessage(
        "First innings complete! Starting second innings...",
        "success"
      );
      this.showSecondInningsModal();
    }
  }

  showSecondInningsModal() {
    // Populate dropdowns for second innings
    if (this.currentMatch) {
      // The backend has already swapped the teams in _end_innings, so we use the current teams
      const newBattingTeam =
        this.currentMatch.batting_team === this.currentMatch.team1.name
          ? this.currentMatch.team1 // Use current batting team (already swapped by backend)
          : this.currentMatch.team2;
      const newBowlingTeam =
        this.currentMatch.bowling_team === this.currentMatch.team1.name
          ? this.currentMatch.team1 // Use current bowling team (already swapped by backend)
          : this.currentMatch.team2;

      // Get list of dismissed players from fall_of_wickets for the new batting team
      const dismissedPlayers = new Set();
      if (this.currentMatch.fall_of_wickets) {
        this.currentMatch.fall_of_wickets.forEach((wicket) => {
          // Check if dismissed player belongs to the new batting team
          if (newBattingTeam.players.includes(wicket.player)) {
            dismissedPlayers.add(wicket.player);
          }
        });
      }

      // Populate batting team dropdowns (exclude dismissed players)
      const battingSelects = [
        "second-striker-select",
        "second-non-striker-select",
      ];
      battingSelects.forEach((selectId) => {
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">Select Player</option>';
        newBattingTeam.players.forEach((player) => {
          // Exclude dismissed players from second innings selection
          if (!dismissedPlayers.has(player)) {
            const option = document.createElement("option");
            option.value = player;
            option.textContent = player;
            select.appendChild(option);
          }
        });
      });

      // Populate bowling team dropdown
      const bowlingSelect = document.getElementById("second-bowler-select");
      bowlingSelect.innerHTML = '<option value="">Select Player</option>';
      newBowlingTeam.players.forEach((player) => {
        const option = document.createElement("option");
        option.value = player;
        option.textContent = player;
        bowlingSelect.appendChild(option);
      });
    }

    // Show the modal
    this.showModal("second-innings-modal");
  }

  setupEventListeners() {
    // Update team names in toss dropdown when team names change
    document
      .getElementById("team1-name")
      .addEventListener("input", this.updateTossOptions.bind(this));
    document
      .getElementById("team2-name")
      .addEventListener("input", this.updateTossOptions.bind(this));
  }

  updateConnectionStatus(connected) {
    const statusElement = document.getElementById("status-indicator");
    const dotElement = statusElement.querySelector(".status-dot");
    const textElement = statusElement.querySelector(".status-text");

    if (connected) {
      dotElement.classList.add("connected");
      textElement.textContent = "Connected";
    } else {
      dotElement.classList.remove("connected");
      textElement.textContent = "Disconnected";
    }
  }

  updateTossOptions() {
    const team1Name = document.getElementById("team1-name").value;
    const team2Name = document.getElementById("team2-name").value;
    const tossSelect = document.getElementById("toss-winner");

    tossSelect.innerHTML = `
            <option value="">Select Team</option>
            <option value="${team1Name}">${team1Name}</option>
            <option value="${team2Name}">${team2Name}</option>
        `;
  }

  loadSavedMatches() {
    fetch("/api/matches")
      .then((response) => response.json())
      .then((matches) => {
        const select = document.getElementById("saved-matches");
        select.innerHTML = '<option value="">Select a saved match</option>';
        matches.forEach((match) => {
          const option = document.createElement("option");
          option.value = match.id;
          option.textContent = `Match ${match.id}`;
          select.appendChild(option);
        });
      })
      .catch((error) => {
        console.error("Error loading saved matches:", error);
      });
  }

  showSection(sectionId) {
    document.querySelectorAll("section").forEach((section) => {
      section.style.display = "none";
    });
    document.getElementById(sectionId).style.display = "block";
  }

  populatePlayerSelects() {
    if (!this.currentMatch) return;

    const battingTeam =
      this.currentMatch.batting_team === this.currentMatch.team1.name
        ? this.currentMatch.team1
        : this.currentMatch.team2;
    const bowlingTeam =
      this.currentMatch.batting_team === this.currentMatch.team1.name
        ? this.currentMatch.team2
        : this.currentMatch.team1;

    // Get list of dismissed players from fall_of_wickets
    const dismissedPlayers = new Set();
    if (this.currentMatch.fall_of_wickets) {
      this.currentMatch.fall_of_wickets.forEach((wicket) => {
        dismissedPlayers.add(wicket.player);
      });
    }

    // Populate batting selects
    const battingSelects = [
      "opening-striker",
      "opening-non-striker",
      "new-batter-select",
    ];
    battingSelects.forEach((selectId) => {
      const select = document.getElementById(selectId);
      select.innerHTML = '<option value="">Select Player</option>';

      battingTeam.players.forEach((player) => {
        // For new-batter-select, exclude dismissed players
        if (selectId === "new-batter-select" && dismissedPlayers.has(player)) {
          return; // Skip dismissed players
        }

        const option = document.createElement("option");
        option.value = player;
        option.textContent = player;
        select.appendChild(option);
      });
    });

    // Populate bowling selects
    const bowlingSelects = ["opening-bowler", "new-bowler-select"];
    bowlingSelects.forEach((selectId) => {
      const select = document.getElementById(selectId);
      select.innerHTML = '<option value="">Select Player</option>';
      bowlingTeam.players.forEach((player) => {
        const option = document.createElement("option");
        option.value = player;
        option.textContent = player;
        select.appendChild(option);
      });
    });

    // Update dismissed player dropdown with current batsmen
    this.updateDismissedPlayerSelect();
  }

  updateDismissedPlayerSelect() {
    if (!this.currentMatch) return;

    const dismissedSelect = document.getElementById("dismissed-player");
    dismissedSelect.innerHTML = '<option value="">Select Player</option>';

    // Only add current striker and non-striker to the dropdown
    const currentBatsmen = [
      this.currentMatch.striker,
      this.currentMatch.non_striker,
    ];

    currentBatsmen.forEach((player) => {
      if (player) {
        // Check if player exists
        const option = document.createElement("option");
        option.value = player;
        option.textContent = player;
        dismissedSelect.appendChild(option);
      }
    });
  }

  updateMatchDisplay() {
    if (!this.currentMatch) return;

    const battingTeam =
      this.currentMatch.batting_team === this.currentMatch.team1.name
        ? this.currentMatch.team1
        : this.currentMatch.team2;

    const bowlingTeam =
      this.currentMatch.batting_team === this.currentMatch.team1.name
        ? this.currentMatch.team2
        : this.currentMatch.team1;

    // Update match status
    document.getElementById("current-team").textContent = battingTeam.name;
    document.getElementById(
      "current-score"
    ).textContent = `${battingTeam.runs}/${battingTeam.wickets}`;

    // Calculate overs from current match state using cricket notation
    const currentOver = this.currentMatch.current_over || 0;
    const currentBall = this.currentMatch.current_ball || 0;

    // In cricket: complete overs + ball number (e.g., 1.3 = 1 over + 3 balls)
    let actualOvers;
    if (currentOver === 0 || currentBall === 0) {
      actualOvers = "0.0";
    } else {
      const completedOvers = currentOver - 1;
      actualOvers = `${completedOvers}.${currentBall}`;
    }

    document.getElementById(
      "current-overs"
    ).textContent = `(${actualOvers} overs)`;

    // Handle second innings target information
    const targetInfoDiv = document.getElementById("target-info");
    if (this.currentMatch.current_innings === 2) {
      // Show target information for second innings
      targetInfoDiv.style.display = "block";

      const target = bowlingTeam.runs + 1;
      const currentRuns = battingTeam.runs || 0;
      const runsNeeded = target - currentRuns;

      // Calculate remaining balls
      const totalBalls = this.currentMatch.total_overs * 6;
      const ballsPlayed = (currentOver - 1) * 6 + currentBall;
      const ballsRemaining = totalBalls - ballsPlayed;

      // Calculate required run rate
      const requiredRR =
        ballsRemaining > 0
          ? ((runsNeeded / ballsRemaining) * 6).toFixed(2)
          : "0.00";

      // Update target display elements
      document.getElementById(
        "target-display"
      ).textContent = `Target: ${target}`;
      document.getElementById(
        "required-info"
      ).textContent = `Need ${runsNeeded} runs in ${ballsRemaining} balls`;
      document.getElementById(
        "required-rr"
      ).textContent = `Required RR: ${requiredRR}`;

      // Change color based on run rate achievability
      const rrElement = document.getElementById("required-rr");
      if (requiredRR > 12) {
        rrElement.style.color = "#ff6b6b"; // Red for very difficult
      } else if (requiredRR > 8) {
        rrElement.style.color = "#ffa500"; // Orange for challenging
      } else {
        rrElement.style.color = "#90ee90"; // Green for achievable
      }
    } else {
      // Hide target information for first innings
      targetInfoDiv.style.display = "none";
    }

    // Update player info
    document.getElementById("striker-info").textContent = `Striker: ${
      this.currentMatch.striker
    } (${this.currentMatch.players[this.currentMatch.striker]?.runs || 0}*)`;
    document.getElementById("non-striker-info").textContent = `Non-Striker: ${
      this.currentMatch.non_striker
    } (${this.currentMatch.players[this.currentMatch.non_striker]?.runs || 0})`;
    document.getElementById("bowler-info").textContent = `Bowler: ${
      this.currentMatch.bowler
    } (${actualOvers}-${
      this.currentMatch.players[this.currentMatch.bowler]?.runs_conceded || 0
    }-${
      this.currentMatch.players[this.currentMatch.bowler]?.wickets_taken || 0
    })`;

    // Update current over
    document.getElementById("current-over-balls").textContent =
      this.currentMatch.last_over_summary || "-";

    // Update dismissed player dropdown with current batsmen
    this.updateDismissedPlayerSelect();
  }

  showMessage(message, type = "info") {
    const messagesContainer = document.getElementById("messages");
    const messageEl = document.createElement("div");
    messageEl.className = `message ${type}`;
    messageEl.textContent = message;

    messagesContainer.appendChild(messageEl);

    setTimeout(() => {
      messageEl.remove();
    }, 5000);
  }

  resetBallInput() {
    this.pendingBall = {
      runs: 0,
      isWicket: false,
      extraType: null,
      extraRuns: 0,
    };

    // Reset UI
    document
      .querySelectorAll(".run-btn.selected")
      .forEach((btn) => btn.classList.remove("selected"));
    document
      .querySelectorAll(".extra-btn.selected")
      .forEach((btn) => btn.classList.remove("selected"));
    document
      .querySelectorAll(".wicket-btn.selected")
      .forEach((btn) => btn.classList.remove("selected"));
    document.getElementById("extra-runs").style.display = "none";
    document.getElementById("wicket-details").style.display = "none";
  }

  isMatchActive() {
    const active = this.currentMatch && this.currentMatch.is_started;
    console.log(
      "isMatchActive:",
      active,
      "(hasMatch:",
      !!this.currentMatch,
      "isStarted:",
      this.currentMatch ? this.currentMatch.is_started : "no match",
      ")"
    );
    return active;
  }

  updateUndoButtonState() {
    const undoButton = document.querySelector(
      'button[onclick="undoLastBall()"]'
    );
    if (!undoButton) {
      console.log("Undo button not found");
      return;
    }

    const isActive = this.isMatchActive();

    // Enable undo if there's an active match and balls have been played
    if (isActive && this.currentMatch) {
      // Check if there are any balls that can be undone
      let hasPlayedBalls = false;
      let totalBalls = 0;

      if (this.currentMatch.overs && this.currentMatch.overs.length > 0) {
        // Count all balls across all overs
        this.currentMatch.overs.forEach((over) => {
          if (over.balls && over.balls.length > 0) {
            totalBalls += over.balls.length;
          }
        });
        hasPlayedBalls = totalBalls > 0;
      }

      console.log("UNDO BUTTON STATE:", {
        isMatchActive: isActive,
        hasOvers: this.currentMatch.overs ? this.currentMatch.overs.length : 0,
        totalBalls: totalBalls,
        hasPlayedBalls: hasPlayedBalls,
        willEnable: hasPlayedBalls,
      });

      undoButton.disabled = !hasPlayedBalls;
    } else {
      console.log("UNDO BUTTON DISABLED: No active match or match not started");
      undoButton.disabled = true;
    }
  }

  showModal(modalId) {
    document.getElementById(modalId).style.display = "flex";
  }

  closeModal(modalId) {
    document.getElementById(modalId).style.display = "none";
  }

  showNewBowlerModal() {
    // Populate the new bowler dropdown
    if (this.currentMatch) {
      const bowlingTeam =
        this.currentMatch.batting_team === this.currentMatch.team1.name
          ? this.currentMatch.team2
          : this.currentMatch.team1;

      const newBowlerSelect = document.getElementById("new-bowler-select");
      newBowlerSelect.innerHTML = '<option value="">Select Bowler</option>';

      bowlingTeam.players.forEach((player) => {
        const option = document.createElement("option");
        option.value = player;
        option.textContent = player;
        newBowlerSelect.appendChild(option);
      });
    }

    this.showModal("new-bowler-modal");
  }

  showNewBatterModal() {
    // Populate the new batter dropdown with only non-dismissed players
    if (this.currentMatch) {
      const battingTeam =
        this.currentMatch.batting_team === this.currentMatch.team1.name
          ? this.currentMatch.team1
          : this.currentMatch.team2;

      // Get list of dismissed players from fall_of_wickets
      const dismissedPlayers = new Set();
      if (this.currentMatch.fall_of_wickets) {
        this.currentMatch.fall_of_wickets.forEach((wicket) => {
          dismissedPlayers.add(wicket.player);
        });
      }

      // Also exclude current batsmen (striker and non-striker) from selection
      const currentBatsmen = new Set([
        this.currentMatch.striker,
        this.currentMatch.non_striker,
      ]);

      const newBatterSelect = document.getElementById("new-batter-select");
      newBatterSelect.innerHTML = '<option value="">Select Batter</option>';

      battingTeam.players.forEach((player) => {
        // Exclude dismissed players and current batsmen
        if (!dismissedPlayers.has(player) && !currentBatsmen.has(player)) {
          const option = document.createElement("option");
          option.value = player;
          option.textContent = player;
          newBatterSelect.appendChild(option);
        }
      });
    }

    this.showModal("new-batter-modal");
  }
}

// Initialize the control panel
let controlPanel;

function initializeControlPanel() {
  console.log("Initializing control panel...");
  try {
    if (typeof io === "undefined") {
      console.log("Socket.IO not ready yet, retrying in 100ms...");
      setTimeout(initializeControlPanel, 100);
      return;
    }
    controlPanel = new CricketControl();
    console.log("Control panel initialized successfully");
  } catch (error) {
    console.error("Error initializing control panel:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing control panel...");
  initializeControlPanel();
});

// Global functions for button clicks
function createMatch() {
  console.log("createMatch function called");

  // Check if controlPanel is initialized
  if (!controlPanel) {
    console.error("Control panel not initialized");
    alert("Control panel not ready. Please refresh the page.");
    return;
  }

  if (!controlPanel.socket) {
    console.error("Socket not available");
    alert("Socket connection not available. Please refresh the page.");
    return;
  }

  const team1Name = document.getElementById("team1-name").value;
  const team2Name = document.getElementById("team2-name").value;
  const totalOvers = document.getElementById("total-overs").value;
  const tossWinner = document.getElementById("toss-winner").value;
  const tossDecision = document.getElementById("toss-decision").value;

  console.log("Form values:", {
    team1Name,
    team2Name,
    totalOvers,
    tossWinner,
    tossDecision,
  });

  if (!team1Name || !team2Name || !totalOvers || !tossWinner) {
    console.log("Validation failed - missing required fields");
    controlPanel.showMessage("Please fill in all required fields", "error");
    return;
  }

  const team1Players = document
    .getElementById("team1-players")
    .value.split("\n")
    .filter((p) => p.trim());
  const team2Players = document
    .getElementById("team2-players")
    .value.split("\n")
    .filter((p) => p.trim());

  console.log("Player counts:", {
    team1: team1Players.length,
    team2: team2Players.length,
  });

  if (team1Players.length < 11 || team2Players.length < 11) {
    console.log("Validation failed - not enough players");
    controlPanel.showMessage(
      "Each team must have at least 11 players",
      "error"
    );
    return;
  }

  console.log("Sending create_match event...");
  console.log("Socket connected:", controlPanel.socket.connected);

  controlPanel.socket.emit("create_match", {
    team1: team1Name,
    team2: team2Name,
    total_overs: parseInt(totalOvers),
    toss_winner: tossWinner,
    toss_decision: tossDecision,
    team1_players: team1Players,
    team2_players: team2Players,
  });
}

function loadMatch() {
  const matchId = document.getElementById("saved-matches").value;
  if (!matchId) {
    controlPanel.showMessage("Please select a match to load", "error");
    return;
  }

  controlPanel.socket.emit("load_match", { match_id: matchId });
}

function startInnings() {
  const striker = document.getElementById("opening-striker").value;
  const nonStriker = document.getElementById("opening-non-striker").value;
  const bowler = document.getElementById("opening-bowler").value;

  if (!striker || !nonStriker || !bowler) {
    controlPanel.showMessage("Please select all opening players", "error");
    return;
  }

  if (striker === nonStriker) {
    controlPanel.showMessage(
      "Striker and non-striker must be different players",
      "error"
    );
    return;
  }

  controlPanel.socket.emit("start_innings", {
    striker: striker,
    non_striker: nonStriker,
    bowler: bowler,
  });
}

function addRuns(runs) {
  // Reset previous selections
  document
    .querySelectorAll(".run-btn.selected")
    .forEach((btn) => btn.classList.remove("selected"));

  // Select current button
  event.target.classList.add("selected");

  controlPanel.pendingBall.runs = runs;
}

function addExtra(extraType) {
  // Reset previous selections
  document
    .querySelectorAll(".extra-btn.selected")
    .forEach((btn) => btn.classList.remove("selected"));

  if (controlPanel.pendingBall.extraType === extraType) {
    // Deselect if same type clicked
    controlPanel.pendingBall.extraType = null;
    document.getElementById("extra-runs").style.display = "none";
  } else {
    // Select new type
    event.target.classList.add("selected");
    controlPanel.pendingBall.extraType = extraType;
    document.getElementById("extra-runs").style.display = "block";
    document.getElementById("extra-runs").focus();
  }
}

function toggleWicket() {
  const wicketBtn = document.querySelector(".wicket-btn");
  const wicketDetails = document.getElementById("wicket-details");

  if (controlPanel.pendingBall.isWicket) {
    // Deselect wicket
    controlPanel.pendingBall.isWicket = false;
    wicketBtn.classList.remove("selected");
    wicketDetails.style.display = "none";
  } else {
    // Select wicket
    controlPanel.pendingBall.isWicket = true;
    wicketBtn.classList.add("selected");
    wicketDetails.style.display = "block";
    // Update the dismissed player dropdown with current batsmen
    controlPanel.updateDismissedPlayerSelect();
  }
}

function submitBall() {
  const ballData = {
    runs: controlPanel.pendingBall.runs,
    is_wicket: controlPanel.pendingBall.isWicket,
  };

  if (controlPanel.pendingBall.extraType) {
    ballData.extra_type = controlPanel.pendingBall.extraType;
    ballData.extra_runs =
      parseInt(document.getElementById("extra-runs").value) || 1;
  }

  if (controlPanel.pendingBall.isWicket) {
    ballData.wicket_type = document.getElementById("wicket-type").value;
    ballData.dismissed_player =
      document.getElementById("dismissed-player").value;

    if (!ballData.dismissed_player) {
      controlPanel.showMessage("Please select the dismissed player", "error");
      return;
    }
  }

  controlPanel.socket.emit("add_ball", ballData);
}

function undoLastBall() {
  if (!controlPanel.isMatchActive()) {
    controlPanel.showMessage("No active match", "error");
    return;
  }

  if (confirm("Are you sure you want to undo the last ball?")) {
    controlPanel.socket.emit("undo_last_ball");
  }
}

function setNewBowler() {
  const bowler = document.getElementById("new-bowler-select").value;
  if (!bowler) {
    controlPanel.showMessage("Please select a bowler", "error");
    return;
  }

  controlPanel.socket.emit("set_new_bowler", { bowler: bowler });
}

function setNewBatter() {
  const batter = document.getElementById("new-batter-select").value;
  if (!batter) {
    controlPanel.showMessage("Please select a batter", "error");
    return;
  }

  controlPanel.socket.emit("set_new_batter", { batter: batter });
}

function startSecondInnings() {
  const striker = document.getElementById("second-striker-select").value;
  const nonStriker = document.getElementById("second-non-striker-select").value;
  const bowler = document.getElementById("second-bowler-select").value;

  if (!striker || !nonStriker || !bowler) {
    controlPanel.showMessage("Please select all players", "error");
    return;
  }

  if (striker === nonStriker) {
    controlPanel.showMessage(
      "Striker and non-striker must be different players",
      "error"
    );
    return;
  }

  controlPanel.socket.emit("start_second_innings", {
    striker: striker,
    non_striker: nonStriker,
    bowler: bowler,
  });
}

function createNewMatch() {
  // Reset the application to create a new match
  location.reload();
}
