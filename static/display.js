class CricketDisplay {
  constructor() {
    this.socket = io();
    this.currentMatch = null;
    this.previousOvers = [];
    this.initializeSocket();
  }

  initializeSocket() {
    this.socket.on("connect", () => {
      console.log("Connected to server");
      this.updateConnectionStatus(true);
      // Set default state after connection
      this.showDefaultState();
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from server");
      this.updateConnectionStatus(false);
    });

    this.socket.on("match_update", (matchData) => {
      console.log("Match update received:", matchData);
      console.log("Match finished status:", matchData.is_finished);
      console.log("Match winner:", matchData.winner);
      console.log("Match result:", matchData.match_result);
      console.log("Players data:", matchData.players);
      console.log("Current striker:", matchData.striker);
      console.log("Current non_striker:", matchData.non_striker);
      console.log("Current bowler:", matchData.bowler);
      this.currentMatch = matchData;
      this.updateDisplay();
    });

    this.socket.on("ball_added", (result) => {
      console.log("Ball added result:", result);
      if (result.action === "match_complete") {
        console.log("Match completed event received:", result);
        // The match_update will be sent separately, but we can handle immediate result here
      }
    });

    this.socket.on("error", (error) => {
      console.error("Socket error:", error);
      this.showError("Connection error");
    });

    this.socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      this.updateConnectionStatus(false);
    });
  }

  updateConnectionStatus(connected) {
    const statusTextElement = document.querySelector(
      "#connection-status .status-text"
    );
    if (statusTextElement) {
      statusTextElement.textContent = connected ? "🟢 LIVE" : "🔴 OFFLINE";
    }

    const statusElement = document.getElementById("connection-status");
    if (statusElement) {
      statusElement.className = connected
        ? "connection-status live"
        : "connection-status offline";
    }

    if (!connected) {
      this.showDefaultState();
    }
  }

  updateDisplay() {
    console.log("updateDisplay called with match data:", this.currentMatch);

    if (!this.currentMatch) {
      console.log("No match data, showing default state");
      this.updateDebugInfo("No match data");
      this.showDefaultState();
      return;
    }

    // Update debug info
    this.updateDebugInfo();

    // Check if match is finished and show result
    console.log("Match finished status:", this.currentMatch.is_finished);
    console.log("Match winner:", this.currentMatch.winner);
    console.log("Match result:", this.currentMatch.match_result);

    if (this.currentMatch.is_finished) {
      console.log("Match is finished, showing result overlay");
      this.showMatchResult();
      return;
    }

    console.log("Updating display with live match data");
    this.updateTeamInfo();
    this.updateMatchStatus();
    this.updatePlayerCards();
    this.updateOverInfo();
    this.updateStats();
    this.updateLastWicket();

    // Update scorecard if it's currently visible
    const scorecardSection = document.getElementById("scorecard-section");
    if (scorecardSection && scorecardSection.style.display !== "none") {
      populateScorecard(this.currentMatch);
    }
  }

  showDefaultState() {
    console.log("Setting default state for all elements");

    // Set default team info
    const team1Name = document.getElementById("team1-name");
    const team1Runs = document.getElementById("team1-runs");
    const team1Wickets = document.getElementById("team1-wickets");
    const team1Overs = document.getElementById("team1-overs");
    const team2Name = document.getElementById("team2-name");
    const team2Runs = document.getElementById("team2-runs");

    console.log("Elements found:", {
      team1Name: !!team1Name,
      team1Runs: !!team1Runs,
      team1Wickets: !!team1Wickets,
      team1Overs: !!team1Overs,
      team2Name: !!team2Name,
      team2Runs: !!team2Runs,
    });

    if (team1Name) team1Name.textContent = "TEAM A";
    if (team1Runs) team1Runs.textContent = "0";
    if (team1Wickets) team1Wickets.textContent = "0";
    if (team1Overs) team1Overs.textContent = "0.0";
    if (team2Name) team2Name.textContent = "TEAM B";
    if (team2Runs) team2Runs.textContent = "0";

    // Set default stats bar
    const currentRR = document.getElementById("current-rr");
    const partnership = document.getElementById("partnership");
    const matchStatus = document.getElementById("match-status");
    const targetInfo = document.getElementById("target-info");

    if (currentRR) currentRR.textContent = "0.00";
    if (partnership) partnership.textContent = "0 (0)";
    if (matchStatus) matchStatus.textContent = "NO MATCH";
    if (targetInfo) targetInfo.textContent = "NO TARGET";

    console.log("Stats elements found:", {
      currentRR: !!currentRR,
      partnership: !!partnership,
      matchStatus: !!matchStatus,
      targetInfo: !!targetInfo,
    }); // Set default player cards
    document.getElementById("striker-role").textContent = "NO STRIKER";
    document.getElementById("striker-name").textContent = "NO STRIKER";
    document.getElementById("striker-runs").textContent = "0";
    document.getElementById("striker-balls").textContent = "0";
    document.getElementById("striker-fours").textContent = "0";
    document.getElementById("striker-sixes").textContent = "0";
    document.getElementById("striker-sr").textContent = "0.00";

    document.getElementById("non-striker-role").textContent = "NO NON-STRIKER";
    document.getElementById("non-striker-name").textContent = "NO NON-STRIKER";
    document.getElementById("non-striker-runs").textContent = "0";
    document.getElementById("non-striker-balls").textContent = "0";
    document.getElementById("non-striker-fours").textContent = "0";
    document.getElementById("non-striker-sixes").textContent = "0";
    document.getElementById("non-striker-sr").textContent = "0.00";

    document.getElementById("bowler-name").textContent = "NO BOWLER";
    document.getElementById("bowler-overs").textContent = "0.0";
    document.getElementById("bowler-wickets").textContent = "0-0";
    document.getElementById("bowler-economy").textContent = "0.00";

    // Clear over details
    const overBallsEl = document.getElementById("over-balls");
    if (overBallsEl) overBallsEl.textContent = "";

    const currentOverBallsEl = document.getElementById("current-over-balls");
    if (currentOverBallsEl) currentOverBallsEl.textContent = "";

    // These elements may not exist, so check first
    const currentOverEl = document.getElementById("current-over");
    if (currentOverEl) currentOverEl.textContent = "0.0";

    const runRateEl = document.getElementById("run-rate");
    if (runRateEl) runRateEl.textContent = "0.00";

    const reqRateEl = document.getElementById("req-rate");
    if (reqRateEl) reqRateEl.textContent = "0.00";

    const targetEl = document.getElementById("target");
    if (targetEl) targetEl.textContent = "N/A";

    // Clear over details
    const thisOverEl = document.getElementById("this-over");
    if (thisOverEl) thisOverEl.textContent = "";

    const previousOverEl = document.getElementById("previous-over");
    if (previousOverEl) previousOverEl.textContent = "";

    // Clear stats
    const statsList = document.getElementById("stats-list");
    if (statsList) {
      statsList.innerHTML = "<li>No statistics available</li>";
    }

    // Clear last wicket
    const lastWicketEl = document.getElementById("last-wicket-info");
    if (lastWicketEl) lastWicketEl.textContent = "No wickets";

    // Clear team flags
    this.updateTeamFlag("team1-flag", "");
    this.updateTeamFlag("team2-flag", "");
  }

  updateTeamInfo() {
    if (!this.currentMatch) return;

    console.log("updateTeamInfo called with:", this.currentMatch);

    // The data structure has:
    // - batting_team: string (team name)
    // - bowling_team: string (team name)
    // - team1: object, team2: object
    // - current_innings: number

    const battingTeamName = this.currentMatch.batting_team;
    const bowlingTeamName = this.currentMatch.bowling_team;
    const team1 = this.currentMatch.team1;
    const team2 = this.currentMatch.team2;

    console.log("Team data:", {
      battingTeamName,
      bowlingTeamName,
      team1,
      team2,
    });

    // Determine which team object is batting
    let battingTeam, bowlingTeam;
    if (team1.name === battingTeamName) {
      battingTeam = team1;
      bowlingTeam = team2;
    } else {
      battingTeam = team2;
      bowlingTeam = team1;
    }

    console.log("Selected teams:", { battingTeam, bowlingTeam });
    console.log(
      "Match current_over:",
      this.currentMatch.current_over,
      "current_ball:",
      this.currentMatch.current_ball
    );

    // Update batting team (currently playing)
    document.getElementById("team1-name").textContent = battingTeam.name;
    document.getElementById("team1-runs").textContent = battingTeam.runs || 0;
    document.getElementById("team1-wickets").textContent =
      battingTeam.wickets || 0;

    // Update team flags
    this.updateTeamFlag(
      "team1-flag",
      battingTeam.name === team1.name
        ? this.currentMatch.team1_flag
        : this.currentMatch.team2_flag
    );
    this.updateTeamFlag(
      "team2-flag",
      bowlingTeam.name === team1.name
        ? this.currentMatch.team1_flag
        : this.currentMatch.team2_flag
    );

    // Update current overs for batting team - use match-level current_over and current_ball
    const currentOver = this.currentMatch.current_over || 0;
    const currentBall = this.currentMatch.current_ball || 0;
    // Cricket overs: current_over is 1-based, but display should show completed overs (0-based)
    // So current_over=1, current_ball=1 should display as "0.1"
    const completedOvers = Math.max(0, currentOver - 1);
    const currentOverDisplay = `${completedOvers}.${currentBall}`;
    console.log("Over calculation:", {
      currentOver,
      currentBall,
      completedOvers,
      currentOverDisplay,
    });

    // Show current overs for batting team (team1 position)
    const team1OversElement = document.getElementById("team1-overs");
    if (team1OversElement) {
      team1OversElement.style.display = "block";
      team1OversElement.textContent = currentOverDisplay;
    }

    // Show overs for bowling team (team2 position) if they have batted
    const team2OversElement = document.getElementById("team2-overs");
    if (team2OversElement) {
      if (bowlingTeam.overs !== undefined) {
        team2OversElement.style.display = "block";
        team2OversElement.textContent = bowlingTeam.overs;
      } else {
        team2OversElement.style.display = "none";
      }
    }

    // Update current run rate - calculate from actual balls bowled
    const teamRuns = battingTeam.runs || 0;

    // Calculate total balls bowled from current_over and current_ball
    const totalBalls = (currentOver - 1) * 6 + currentBall;
    const actualOvers = totalBalls > 0 ? totalBalls / 6 : 0;

    const runRate =
      actualOvers > 0 ? (teamRuns / actualOvers).toFixed(2) : "0.00";
    console.log("Run rate calculation:", {
      teamRuns,
      totalBalls,
      actualOvers,
      runRate,
    });

    const currentRrElement = document.getElementById("current-rr");
    if (currentRrElement) {
      currentRrElement.textContent = runRate;
      console.log("CRR updated to:", runRate);
    } else {
      console.error("current-rr element not found!");
    }

    // Update bowling team
    document.getElementById("team2-name").textContent = bowlingTeam.name;
    if (bowlingTeam.runs !== undefined) {
      document.getElementById(
        "team2-runs"
      ).textContent = `${bowlingTeam.runs}/${bowlingTeam.wickets}`;
    } else {
      document.getElementById("team2-runs").textContent = "Yet to bat";
    }

    // Update target info based on match state
    if (
      this.currentMatch.current_innings === 2 &&
      bowlingTeam.runs !== undefined
    ) {
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

      // Update target-info with comprehensive information
      document.getElementById(
        "target-info"
      ).textContent = `Target: ${target} | Need ${runsNeeded} in ${ballsRemaining}`;

      // Show required run rate in stats bar
      const reqRrStat = document.getElementById("required-rr-stat");
      const needRunsStat = document.getElementById("need-runs-stat");
      const defaultStat = document.getElementById("default-stat");

      if (reqRrStat && needRunsStat && defaultStat) {
        reqRrStat.style.display = "block";
        needRunsStat.style.display = "block";
        defaultStat.style.display = "none";

        document.getElementById("required-rr-value").textContent = requiredRR;
        document.getElementById(
          "need-runs-value"
        ).textContent = `${runsNeeded} in ${ballsRemaining}`;

        // Color code the required run rate
        const rrElement = document.getElementById("required-rr-value");
        if (requiredRR > 12) {
          rrElement.style.color = "#ff6b6b"; // Red for very difficult
        } else if (requiredRR > 8) {
          rrElement.style.color = "#ffa500"; // Orange for challenging
        } else {
          rrElement.style.color = "#90ee90"; // Green for achievable
        }
      }
    } else {
      // First innings or no target data - show toss information
      const tossWinner = this.currentMatch.toss_winner || "";
      const tossDecision = this.currentMatch.toss_decision || "";

      if (tossWinner && tossDecision) {
        document.getElementById(
          "target-info"
        ).textContent = `${tossWinner} OPT TO ${tossDecision.toUpperCase()}`;
      } else {
        // Fallback if toss data is not available
        document.getElementById(
          "target-info"
        ).textContent = `${bowlingTeamName} OPT TO BOWL`;
      }

      // Hide required run rate stats and show default
      const reqRrStat = document.getElementById("required-rr-stat");
      const needRunsStat = document.getElementById("need-runs-stat");
      const defaultStat = document.getElementById("default-stat");

      if (reqRrStat && needRunsStat && defaultStat) {
        reqRrStat.style.display = "none";
        needRunsStat.style.display = "none";
        defaultStat.style.display = "block";

        // Update the default stat content with toss information
        const defaultStatLabel = defaultStat.querySelector(".stat-label");
        if (defaultStatLabel && tossWinner && tossDecision) {
          defaultStatLabel.textContent = `${tossWinner} OPT TO ${tossDecision.toUpperCase()}`;
        }
      }
    }

    // Update match status
    const inningsText = this.currentMatch.current_innings === 1 ? "1st" : "2nd";
    document.getElementById(
      "match-status"
    ).textContent = `${inningsText} Innings`;

    // Update partnership (runs and balls for current batsmen)
    this.updatePartnership();
  }

  updatePartnership() {
    if (!this.currentMatch || !this.currentMatch.players) {
      document.getElementById("partnership").textContent = "0 (0)";
      return;
    }

    const players = this.currentMatch.players;
    const strikerName = this.currentMatch.striker;
    const nonStrikerName = this.currentMatch.non_striker;

    let partnershipRuns = 0;
    let partnershipBalls = 0;

    // Calculate partnership runs and balls
    if (strikerName && players[strikerName]) {
      partnershipRuns += players[strikerName].runs || 0;
      partnershipBalls += players[strikerName].balls || 0;
    }

    if (nonStrikerName && players[nonStrikerName]) {
      partnershipRuns += players[nonStrikerName].runs || 0;
      partnershipBalls += players[nonStrikerName].balls || 0;
    }

    document.getElementById(
      "partnership"
    ).textContent = `${partnershipRuns} (${partnershipBalls})`;
  }

  updateMatchStatus() {
    // Match status is now handled in updateTeamInfo
    // This method is kept for compatibility but most logic moved
    return;
  }

  updatePlayerCards() {
    if (!this.currentMatch || !this.currentMatch.players) {
      console.log("No match data or players available");
      return;
    }

    const players = this.currentMatch.players;
    console.log("Available players:", Object.keys(players));

    // Update striker
    const strikerName = this.currentMatch.striker;
    if (strikerName && players[strikerName]) {
      this.updateBatterCard("striker", strikerName, players[strikerName]);
    } else {
      this.updateBatterCard("striker", "NO STRIKER", null);
    }

    // Update non-striker
    const nonStrikerName = this.currentMatch.non_striker;
    if (nonStrikerName && players[nonStrikerName]) {
      this.updateBatterCard(
        "non-striker",
        nonStrikerName,
        players[nonStrikerName]
      );
    } else {
      this.updateBatterCard("non-striker", "NO NON-STRIKER", null);
    }

    // Update bowler
    const bowlerName = this.currentMatch.bowler;
    if (bowlerName && players[bowlerName]) {
      this.updateBowlerCard(bowlerName, players[bowlerName]);
    } else {
      this.updateBowlerCard("NO BOWLER", null);
    }
  }

  updateBatterCard(type, playerName, playerData) {
    const prefix = type === "striker" ? "striker" : "non-striker";
    const roleText = type === "striker" ? "STRIKER" : "NON-STRIKER";

    // Update role and name
    document.getElementById(`${prefix}-role`).textContent = roleText;
    document.getElementById(`${prefix}-name`).textContent = playerName;

    if (playerData) {
      document.getElementById(`${prefix}-runs`).textContent =
        playerData.runs || 0;
      document.getElementById(`${prefix}-balls`).textContent =
        playerData.balls_faced || 0;
      document.getElementById(`${prefix}-fours`).textContent =
        playerData.fours || 0;
      document.getElementById(`${prefix}-sixes`).textContent =
        playerData.sixes || 0;
      const sr =
        playerData.balls_faced > 0
          ? ((playerData.runs / playerData.balls_faced) * 100).toFixed(2)
          : "0.00";
      document.getElementById(`${prefix}-sr`).textContent = sr;
    } else {
      document.getElementById(`${prefix}-runs`).textContent = "0";
      document.getElementById(`${prefix}-balls`).textContent = "0";
      document.getElementById(`${prefix}-fours`).textContent = "0";
      document.getElementById(`${prefix}-sixes`).textContent = "0";
      document.getElementById(`${prefix}-sr`).textContent = "0.00";
    }
  }

  updateBowlerCard(playerName, playerData) {
    document.getElementById("bowler-name").textContent = playerName;

    if (playerData) {
      // Get overs from overs_bowled field
      const oversFromData = playerData.overs_bowled || 0;

      // For current over in progress, calculate from match state
      const currentOver = this.currentMatch.current_over || 0;
      const currentBall = this.currentMatch.current_ball || 0;

      // If this is the current bowler, add current partial over
      let displayOvers;
      if (playerName === this.currentMatch.bowler && currentBall > 0) {
        const completedOvers = Math.floor(oversFromData);
        displayOvers = `${completedOvers}.${currentBall}`;
      } else {
        // Just show completed overs
        const completedOvers = Math.floor(oversFromData);
        displayOvers = `${completedOvers}.0`;
      }

      document.getElementById("bowler-overs").textContent = displayOvers;

      // The HTML expects "wickets-runs" format in bowler-wickets element
      document.getElementById("bowler-wickets").textContent = `${
        playerData.wickets_taken || 0
      }-${playerData.runs_conceded || 0}`;

      // Calculate economy rate using total overs (including partial)
      const totalOversForEconomy =
        oversFromData +
        (playerName === this.currentMatch.bowler ? currentBall / 6 : 0);
      const economy =
        totalOversForEconomy > 0
          ? ((playerData.runs_conceded || 0) / totalOversForEconomy).toFixed(2)
          : "0.00";
      document.getElementById("bowler-economy").textContent = economy;
    } else {
      document.getElementById("bowler-overs").textContent = "0.0";
      document.getElementById("bowler-wickets").textContent = "0-0";
      document.getElementById("bowler-economy").textContent = "0.00";
    }
  }

  updateOverInfo() {
    if (!this.currentMatch) return;

    console.log("Updating over info with match data:", this.currentMatch);
    console.log("Match overs:", this.currentMatch.overs);

    const overSection = document.querySelector(".over-section");
    const overHeader = document.querySelector(".over-header");

    // Get current batting team name
    const currentBattingTeam = this.currentMatch.batting_team;
    const currentInnings = this.currentMatch.current_innings;

    console.log("Current batting team:", currentBattingTeam);
    console.log("Current innings:", currentInnings);

    // Get all balls from all overs, but only from current innings/batting team
    const allBalls = [];
    const overs = this.currentMatch.overs || [];

    // Collect balls only from the current batting team's overs
    overs.forEach((over) => {
      if (over.balls && over.balls.length > 0) {
        // Check if this over belongs to current batting team by checking the innings
        // We'll include all overs for now and rely on match data structure
        over.balls.forEach((ball, ballIndex) => {
          allBalls.push({
            ...ball,
            overNumber: over.over_number || 1,
            ballInOver: ballIndex + 1,
          });
        });
      }
    });

    console.log("All balls collected for current team:", allBalls);

    // Get the last 12 balls from current batting team only
    const recentBalls = allBalls.slice(-12);
    console.log("Last 12 balls from current team:", recentBalls);

    // Hide over section if no balls from current team or no balls at all
    if (!recentBalls.length || recentBalls.length === 0) {
      if (overSection) {
        overSection.style.display = "none";
      }
      if (overHeader) {
        overHeader.innerHTML = "";
      }
      return;
    }

    // Show the over section only if we have balls from current team
    if (overSection) {
      overSection.style.display = "block";
    }

    // Update the over header to show recent balls
    if (overHeader && recentBalls.length > 0) {
      // Show all recent balls in a single line
      const ballsHtml = this.formatBallsAsHtml(recentBalls);
      const totalRuns = recentBalls.reduce(
        (sum, ball) => sum + (ball.runs || 0) + (ball.extra_runs || 0),
        0
      );

      const overHtml = `
        <div class="over-line">
          <span class="over-label">LAST ${recentBalls.length} BALLS:</span>
          <span class="over-balls">${ballsHtml}</span>
          <span class="over-total">=${totalRuns}</span>
        </div>
      `;

      overHeader.innerHTML = overHtml;
    }

    // Fallback for individual elements (keeping for compatibility)
    const currentOverBallsEl = document.getElementById("current-over-balls");
    if (currentOverBallsEl) {
      if (recentBalls.length > 0) {
        // Show current over balls only
        const currentOverNum = this.currentMatch.current_over || 1;
        const currentOverBalls = recentBalls.filter(
          (ball) => ball.overNumber === currentOverNum
        );
        currentOverBallsEl.textContent = this.formatOverBalls(currentOverBalls);
      } else {
        currentOverBallsEl.textContent = "";
      }
    }

    const overBallsEl = document.getElementById("over-balls");
    if (overBallsEl) {
      if (recentBalls.length > 0) {
        overBallsEl.textContent = this.formatOverBalls(recentBalls.slice(-6)); // Last 6 balls
      } else {
        overBallsEl.textContent = "";
      }
    }

    // Fallback elements
    const thisOverEl = document.getElementById("this-over");
    if (thisOverEl) {
      if (recentBalls.length > 0) {
        const currentOverNum = this.currentMatch.current_over || 1;
        const currentOverBalls = recentBalls.filter(
          (ball) => ball.overNumber === currentOverNum
        );
        thisOverEl.textContent = this.formatOverBalls(currentOverBalls);
      } else {
        thisOverEl.textContent = "";
      }
    }

    const previousOverEl = document.getElementById("previous-over");
    if (previousOverEl) {
      if (recentBalls.length > 6) {
        previousOverEl.textContent = this.formatOverBalls(
          recentBalls.slice(-12, -6)
        );
      } else {
        previousOverEl.textContent = "";
      }
    }
  }

  formatOverBalls(balls) {
    if (!balls || balls.length === 0) return "";

    return balls
      .map((ball) => {
        // Handle wickets
        if (ball.is_wicket) return "W";

        // Handle extras
        if (ball.extra_type) {
          const totalRuns = ball.runs + (ball.extra_runs || 0);
          switch (ball.extra_type) {
            case "wide":
              return totalRuns > 1 ? `${totalRuns}wd` : "wd";
            case "no_ball":
              return totalRuns > 1 ? `${totalRuns}nb` : "nb";
            case "bye":
              return totalRuns > 0 ? `${totalRuns}b` : "b";
            case "leg_bye":
              return totalRuns > 0 ? `${totalRuns}lb` : "lb";
            default:
              return ball.runs.toString();
          }
        }

        // Regular runs
        return ball.runs.toString();
      })
      .join(" ");
  }

  formatOverBallsAsHtml(balls) {
    if (!balls || balls.length === 0) return "";

    return balls
      .map((ball) => {
        let ballText = "";
        let extraClass = "";

        // Handle wickets
        if (ball.is_wicket) {
          ballText = "W";
          extraClass = " wicket-ball";
        } else if (ball.extra_type) {
          // Handle extras
          const totalRuns = ball.runs + (ball.extra_runs || 0);
          switch (ball.extra_type) {
            case "wide":
              ballText = totalRuns > 1 ? `${totalRuns}wd` : "wd";
              extraClass = " extra-ball";
              break;
            case "no_ball":
              ballText = totalRuns > 1 ? `${totalRuns}nb` : "nb";
              extraClass = " extra-ball";
              break;
            case "bye":
              ballText = totalRuns > 0 ? `${totalRuns}b` : "b";
              extraClass = " extra-ball";
              break;
            case "leg_bye":
              ballText = totalRuns > 0 ? `${totalRuns}lb` : "lb";
              extraClass = " extra-ball";
              break;
            default:
              ballText = ball.runs.toString();
          }
        } else {
          // Regular runs
          ballText = ball.runs.toString();
          if (ball.runs === 4) extraClass = " four-ball";
          if (ball.runs === 6) extraClass = " six-ball";
        }

        return `<span class="ball-display${extraClass}">${ballText}</span>`;
      })
      .join("");
  }

  formatBallsAsHtml(balls) {
    if (!balls || balls.length === 0) return "";

    return balls
      .map((ball) => {
        let ballText = "";
        let extraClass = "";

        // Handle wickets
        if (ball.is_wicket) {
          ballText = "W";
          extraClass = " wicket-ball";
        } else if (ball.extra_type) {
          // Handle extras
          const totalRuns = ball.runs + (ball.extra_runs || 0);
          switch (ball.extra_type) {
            case "wide":
              ballText = totalRuns > 1 ? `${totalRuns}wd` : "wd";
              extraClass = " extra-ball";
              break;
            case "no_ball":
              ballText = totalRuns > 1 ? `${totalRuns}nb` : "nb";
              extraClass = " extra-ball";
              break;
            case "bye":
              ballText = totalRuns > 0 ? `${totalRuns}b` : "b";
              extraClass = " extra-ball";
              break;
            case "leg_bye":
              ballText = totalRuns > 0 ? `${totalRuns}lb` : "lb";
              extraClass = " extra-ball";
              break;
            default:
              ballText = ball.runs.toString();
          }
        } else {
          // Regular runs
          ballText = ball.runs.toString();
          if (ball.runs === 4) extraClass = " four-ball";
          if (ball.runs === 6) extraClass = " six-ball";
        }

        return `<span class="ball-display${extraClass}">${ballText}</span>`;
      })
      .join("");
  }

  updateStats() {
    if (!this.currentMatch) return;

    const statsList = document.getElementById("stats-list");
    if (!statsList) return;

    const stats = [];

    // Basic stats that we can derive from available data
    if (this.currentMatch.team1 && this.currentMatch.team2) {
      const battingTeamName = this.currentMatch.batting_team;
      const team1 = this.currentMatch.team1;
      const team2 = this.currentMatch.team2;

      const battingTeam = team1.name === battingTeamName ? team1 : team2;

      stats.push(`Runs: ${battingTeam.runs}`);
      stats.push(`Wickets: ${battingTeam.wickets}`);
      stats.push(`Balls: ${battingTeam.balls}`);

      if (this.currentMatch.current_innings === 2) {
        const bowlingTeam = team1.name === battingTeamName ? team2 : team1;
        const target = bowlingTeam.runs + 1;
        const needed = target - battingTeam.runs;
        stats.push(`Need ${needed} runs to win`);
      }
    }

    statsList.innerHTML =
      stats.length > 0
        ? stats.map((stat) => `<li>${stat}</li>`).join("")
        : "<li>No statistics available</li>";
  }

  updateLastWicket() {
    const lastWicketEl = document.getElementById("last-wicket-info");
    if (!lastWicketEl) return;

    if (
      !this.currentMatch ||
      !this.currentMatch.fall_of_wickets ||
      this.currentMatch.fall_of_wickets.length === 0
    ) {
      lastWicketEl.textContent = "No wickets";
      return;
    }

    // Get the last wicket from fall_of_wickets array
    const lastWicket =
      this.currentMatch.fall_of_wickets[
        this.currentMatch.fall_of_wickets.length - 1
      ];

    if (lastWicket && lastWicket.player) {
      // Determine current batting team's wicket count
      const battingTeamName = this.currentMatch.batting_team;
      let currentWickets = 0;

      if (battingTeamName === this.currentMatch.team1.name) {
        currentWickets = this.currentMatch.team1.wickets || 0;
      } else if (battingTeamName === this.currentMatch.team2.name) {
        currentWickets = this.currentMatch.team2.wickets || 0;
      } else {
        // Fallback: count from fall_of_wickets array
        currentWickets = this.currentMatch.fall_of_wickets.length;
      }

      // Format: "Last Wkt: Player Name (runs/wickets, over)"
      const wicketText = `Last Wkt: ${lastWicket.player} (${lastWicket.runs}/${currentWickets}, ${lastWicket.over})`;
      lastWicketEl.textContent = wicketText;
    } else {
      lastWicketEl.textContent = "No wickets";
    }
  }

  updateDebugInfo(customStatus = null) {
    const debugStatus = document.getElementById("debug-status");
    const debugFinished = document.getElementById("debug-finished");
    const debugWinner = document.getElementById("debug-winner");
    const debugResult = document.getElementById("debug-result");

    if (customStatus) {
      if (debugStatus) debugStatus.textContent = customStatus;
      if (debugFinished) debugFinished.textContent = "-";
      if (debugWinner) debugWinner.textContent = "-";
      if (debugResult) debugResult.textContent = "-";
      return;
    }

    if (
      this.currentMatch &&
      debugStatus &&
      debugFinished &&
      debugWinner &&
      debugResult
    ) {
      debugStatus.textContent = this.currentMatch.is_started
        ? "Live"
        : "Not Started";
      debugFinished.textContent = this.currentMatch.is_finished ? "YES" : "NO";
      debugWinner.textContent = this.currentMatch.winner || "-";
      debugResult.textContent = this.currentMatch.match_result || "-";
    }
  }

  updateTeamFlag(flagElementId, flagUrl) {
    const flagElement = document.getElementById(flagElementId);
    if (!flagElement) return;

    if (flagUrl && flagUrl.trim() !== "") {
      // Clear any existing content and add the flag image
      flagElement.innerHTML = `<img src="${flagUrl}" alt="Team Flag">`;
      flagElement.classList.add("has-image");
    } else {
      // Clear the flag and show default styling
      flagElement.innerHTML = "";
      flagElement.classList.remove("has-image");
    }
  }

  showMatchResult() {
    console.log("Showing match result:", this.currentMatch.match_result);

    const overlay = document.getElementById("match-result-overlay");
    const resultText = document.getElementById("match-result-text");
    const team1Score = document.getElementById("final-team1-score");
    const team2Score = document.getElementById("final-team2-score");

    if (overlay && resultText && team1Score && team2Score) {
      // Set the match result text
      resultText.textContent =
        this.currentMatch.match_result || `${this.currentMatch.winner} won`;

      // Set the final scores
      team1Score.textContent = `${this.currentMatch.team1.name}: ${this.currentMatch.team1.runs}/${this.currentMatch.team1.wickets}`;
      team2Score.textContent = `${this.currentMatch.team2.name}: ${this.currentMatch.team2.runs}/${this.currentMatch.team2.wickets}`;

      // Show the overlay
      overlay.style.display = "flex";
    }
  }

  showMatchResult() {
    console.log("Showing match result:", this.currentMatch.match_result);
    console.log("Current match data:", this.currentMatch);

    const overlay = document.getElementById("match-result-overlay");
    const resultText = document.getElementById("match-result-text");
    const team1Score = document.getElementById("final-team1-score");
    const team2Score = document.getElementById("final-team2-score");

    console.log("Elements found:", {
      overlay: !!overlay,
      resultText: !!resultText,
      team1Score: !!team1Score,
      team2Score: !!team2Score,
    });

    if (overlay && resultText && team1Score && team2Score) {
      // Set the match result text
      const resultTextValue =
        this.currentMatch.match_result || `${this.currentMatch.winner} won`;
      resultText.textContent = resultTextValue;
      console.log("Set result text to:", resultTextValue);

      // Set the final scores
      const team1ScoreText = `${this.currentMatch.team1.name}: ${this.currentMatch.team1.runs}/${this.currentMatch.team1.wickets}`;
      const team2ScoreText = `${this.currentMatch.team2.name}: ${this.currentMatch.team2.runs}/${this.currentMatch.team2.wickets}`;

      team1Score.textContent = team1ScoreText;
      team2Score.textContent = team2ScoreText;

      console.log("Set team scores:", team1ScoreText, team2ScoreText);

      // Show the overlay
      overlay.style.display = "flex";
      console.log("Overlay should now be visible");
    } else {
      console.error("One or more elements not found!");
    }
  }

  closeMatchResult() {
    const overlay = document.getElementById("match-result-overlay");
    if (overlay) {
      overlay.style.display = "none";
    }
  }

  showError(message) {
    console.error("Display error:", message);
    // Could implement toast notification here
  }

  highlightScore() {
    document.getElementById("team1-score").classList.add("highlight");
    setTimeout(() => {
      document.getElementById("team1-score").classList.remove("highlight");
    }, 2000);
  }

  highlightMilestone() {
    // Add milestone highlighting animation
  }

  highlightWicket() {
    // Add wicket highlighting animation
  }
}

// Initialize the display when the page loads
document.addEventListener("DOMContentLoaded", () => {
  const display = new CricketDisplay();
  // Also set default state immediately when DOM is ready
  setTimeout(() => {
    display.showDefaultState();
  }, 100);

  // Make display available globally for testing
  window.cricketDisplay = display;
});

// Test function to manually trigger match result
function testMatchResult() {
  console.log("Testing match result display");
  const testMatch = {
    is_finished: true,
    winner: "Pakistan",
    match_result: "Pakistan won by 11 runs",
    team1: { name: "Pakistan", runs: 22, wickets: 3 },
    team2: { name: "UAE", runs: 11, wickets: 10 },
  };

  window.cricketDisplay.currentMatch = testMatch;
  window.cricketDisplay.showMatchResult();
}

// Scorecard functionality
function showScorecard() {
  const scorecardSection = document.getElementById("scorecard-section");
  if (
    scorecardSection &&
    window.cricketDisplay &&
    window.cricketDisplay.currentMatch
  ) {
    populateScorecard(window.cricketDisplay.currentMatch);
    scorecardSection.style.display = "block";
  }
}

function closeScorecard() {
  const scorecardSection = document.getElementById("scorecard-section");
  if (scorecardSection) {
    scorecardSection.style.display = "none";
  }
}

// Helper function to determine which team batted in which innings based on toss decision
function getTeamForInnings(match, inningsNum) {
  // Handle both live match data (team1/team2) and saved match data (teams.team1/teams.team2)
  let team1, team2;
  if (match.teams) {
    team1 = match.teams.team1;
    team2 = match.teams.team2;
  } else {
    team1 = match.team1;
    team2 = match.team2;
  }

  if (!team1 || !team2) return null;

  // Determine batting order based on toss decision
  let firstBattingTeam, secondBattingTeam;

  if (match.toss_winner && match.toss_decision) {
    if (match.toss_decision === "bat") {
      // Toss winner chose to bat first
      if (match.toss_winner === team1.name) {
        firstBattingTeam = team1;
        secondBattingTeam = team2;
      } else {
        firstBattingTeam = team2;
        secondBattingTeam = team1;
      }
    } else if (match.toss_decision === "bowl") {
      // Toss winner chose to bowl first, so other team bats first
      if (match.toss_winner === team1.name) {
        firstBattingTeam = team2;
        secondBattingTeam = team1;
      } else {
        firstBattingTeam = team1;
        secondBattingTeam = team2;
      }
    }
  }

  // Fallback to simple mapping if toss data is not available
  if (!firstBattingTeam || !secondBattingTeam) {
    firstBattingTeam = team1;
    secondBattingTeam = team2;
  }

  // Return team based on innings number
  return inningsNum === 1 ? firstBattingTeam : secondBattingTeam;
}

// Helper function to determine which team bowled in which innings (opposite of batting team)
function getBowlingTeamForInnings(match, inningsNum) {
  // Handle both live match data (team1/team2) and saved match data (teams.team1/teams.team2)
  let team1, team2;
  if (match.teams) {
    team1 = match.teams.team1;
    team2 = match.teams.team2;
  } else {
    team1 = match.team1;
    team2 = match.team2;
  }

  if (!team1 || !team2) return null;

  // Determine batting order based on toss decision
  let firstBattingTeam, secondBattingTeam;

  if (match.toss_winner && match.toss_decision) {
    if (match.toss_decision === "bat") {
      // Toss winner chose to bat first
      if (match.toss_winner === team1.name) {
        firstBattingTeam = team1;
        secondBattingTeam = team2;
      } else {
        firstBattingTeam = team2;
        secondBattingTeam = team1;
      }
    } else if (match.toss_decision === "bowl") {
      // Toss winner chose to bowl first, so other team bats first
      if (match.toss_winner === team1.name) {
        firstBattingTeam = team2;
        secondBattingTeam = team1;
      } else {
        firstBattingTeam = team1;
        secondBattingTeam = team2;
      }
    }
  }

  // Fallback to simple mapping if toss data is not available
  if (!firstBattingTeam || !secondBattingTeam) {
    firstBattingTeam = team1;
    secondBattingTeam = team2;
  }

  // Return bowling team (opposite of batting team) based on innings number
  return inningsNum === 1 ? secondBattingTeam : firstBattingTeam;
}

function populateScorecard(match) {
  if (!match) return;

  // Update team names and scores
  updateInningsHeader(match, 1);
  updateInningsHeader(match, 2);

  // Update batting and bowling tables
  updateBattingTable(match, 1);
  updateBattingTable(match, 2);
  updateBowlingTable(match, 1);
  updateBowlingTable(match, 2);

  // Show/hide second innings based on match progress
  const innings2Scorecard = document.getElementById("innings2-scorecard");
  if (innings2Scorecard) {
    if (match.current_innings === 2 || match.is_finished) {
      innings2Scorecard.style.display = "block";
    } else {
      innings2Scorecard.style.display = "none";
    }
  }
}

function updateInningsHeader(match, inningsNum) {
  const teamNameEl = document.getElementById(`innings${inningsNum}-team-name`);
  const finalScoreEl = document.getElementById(
    `innings${inningsNum}-final-score`
  );

  if (!teamNameEl || !finalScoreEl) return;

  const team = getTeamForInnings(match, inningsNum);
  if (!team) return;

  teamNameEl.textContent = team.name || "Team";

  let scoreText = `${team.runs || 0}/${team.wickets || 0}`;

  // Calculate overs correctly for current innings
  if (
    inningsNum === match.current_innings &&
    match.current_over &&
    match.current_ball !== undefined
  ) {
    // For current innings, calculate overs from current_over and current_ball
    const currentOver = match.current_over || 0;
    const currentBall = match.current_ball || 0;
    const completedOvers = Math.max(0, currentOver - 1);
    const currentOverDisplay = `${completedOvers}.${currentBall}`;
    scoreText += ` (${currentOverDisplay} ov)`;
  } else if (team.overs !== undefined) {
    // For completed innings, use team.overs
    scoreText += ` (${team.overs} ov)`;
  }

  finalScoreEl.textContent = scoreText;
}

function updateBattingTable(match, inningsNum) {
  const battingRowsEl = document.getElementById(`innings${inningsNum}-batting`);
  const extrasEl = document.getElementById(`innings${inningsNum}-extras`);

  if (!battingRowsEl || !extrasEl) return;

  // Clear existing rows
  battingRowsEl.innerHTML = "";

  const team = getTeamForInnings(match, inningsNum);
  if (!team || !match.players) return;

  // Get team players who batted by checking if they are in the team's player list
  // and have either batted (runs > 0 or balls_faced > 0 or is_out)
  const teamPlayerNames = team.players || [];
  const teamPlayers = teamPlayerNames
    .map((name) => {
      const player = match.players[name];
      return player ? { ...player, name: name } : null; // Ensure name is set
    })
    .filter(
      (player) =>
        player && (player.runs > 0 || player.balls_faced > 0 || player.is_out)
    );

  console.log(
    `Innings ${inningsNum} batting - Team: ${team.name}, Players:`,
    teamPlayers
  );

  teamPlayers.forEach((player) => {
    const row = document.createElement("div");
    row.className = "batting-row";

    const strikeRate =
      player.balls_faced > 0
        ? ((player.runs / player.balls_faced) * 100).toFixed(2)
        : "0.00";

    let dismissalText = "not out";
    if (player.is_out && player.dismissal_type) {
      dismissalText = player.dismissal_type;
      if (player.bowler_name) {
        dismissalText += ` b ${player.bowler_name}`;
      }
    }

    row.innerHTML = `
      <span class="bat-player">${player.name}</span>
      <span class="bat-runs">${player.runs || 0}</span>
      <span class="bat-balls">${player.balls_faced || 0}</span>
      <span class="bat-fours">${player.fours || 0}</span>
      <span class="bat-sixes">${player.sixes || 0}</span>
      <span class="bat-sr">${strikeRate}</span>
      <span class="bat-dismissal">${dismissalText}</span>
    `;

    battingRowsEl.appendChild(row);
  });

  // Update extras
  const extras = team.extras || {};
  const extrasTotal =
    (extras.byes || 0) +
    (extras.leg_byes || 0) +
    (extras.wides || 0) +
    (extras.no_balls || 0);

  let extrasText = `${extrasTotal} (`;
  const extrasBreakdown = [];
  if (extras.byes) extrasBreakdown.push(`b ${extras.byes}`);
  if (extras.leg_byes) extrasBreakdown.push(`lb ${extras.leg_byes}`);
  if (extras.wides) extrasBreakdown.push(`w ${extras.wides}`);
  if (extras.no_balls) extrasBreakdown.push(`nb ${extras.no_balls}`);
  extrasText += extrasBreakdown.join(", ") + ")";

  extrasEl.textContent = extrasText;
}

function updateBowlingTable(match, inningsNum) {
  const bowlingRowsEl = document.getElementById(`innings${inningsNum}-bowling`);

  if (!bowlingRowsEl || !match.players) return;

  // Clear existing rows
  bowlingRowsEl.innerHTML = "";

  const bowlingTeam = getBowlingTeamForInnings(match, inningsNum);
  if (!bowlingTeam) return;

  // Get bowling team players who bowled by checking if they are in the team's player list
  // and have bowling stats (overs_bowled > 0 or balls_bowled > 0)
  const bowlingTeamPlayerNames = bowlingTeam.players || [];
  console.log(
    `Innings ${inningsNum} bowling - Bowling Team: ${bowlingTeam.name}, Player names:`,
    bowlingTeamPlayerNames
  );

  const bowlers = bowlingTeamPlayerNames
    .map((name) => {
      const player = match.players[name];
      if (player) {
        console.log(`Player ${name} bowling stats:`, {
          overs_bowled: player.overs_bowled,
          balls_bowled: player.balls_bowled,
          runs_conceded: player.runs_conceded,
          wickets_taken: player.wickets_taken,
        });
      }
      return player ? { ...player, name: name } : null; // Ensure name is set
    })
    .filter(
      (player) =>
        player &&
        (player.overs_bowled > 0 ||
          player.balls_bowled > 0 ||
          player.runs_conceded > 0 ||
          player.wickets_taken > 0)
    );

  console.log(`Innings ${inningsNum} bowling - Filtered bowlers:`, bowlers);

  bowlers.forEach((bowler) => {
    const row = document.createElement("div");
    row.className = "bowling-row";

    // Calculate overs and balls from overs_bowled (which is a decimal like 1.3 for 1 over 3 balls)
    let oversDecimal = bowler.overs_bowled || 0;

    // If this bowler is currently bowling, add current ball to their overs
    if (match.bowler === bowler.name && match.current_ball > 0) {
      const currentBalls = match.current_ball || 0;
      oversDecimal += currentBalls / 10; // Add current balls as decimal (e.g., 3 balls = 0.3)
    }

    const completeOvers = Math.floor(oversDecimal);
    const extraBalls = Math.round((oversDecimal - completeOvers) * 10); // .3 becomes 3 balls
    const totalBalls = completeOvers * 6 + extraBalls;

    const oversText =
      extraBalls > 0 ? `${completeOvers}.${extraBalls}` : `${completeOvers}`;

    // Calculate economy rate for current match state
    let economy = "0.00";
    if (totalBalls > 0) {
      let runsForEconomy = bowler.runs_conceded || 0;
      // If this is the current bowler, we might need to account for current over runs
      economy = ((runsForEconomy / totalBalls) * 6).toFixed(2);
    }

    row.innerHTML = `
      <span class="bowl-player">${bowler.name}</span>
      <span class="bowl-overs">${oversText}</span>
      <span class="bowl-maidens">${bowler.maidens || 0}</span>
      <span class="bowl-runs">${bowler.runs_conceded || 0}</span>
      <span class="bowl-wickets">${bowler.wickets_taken || 0}</span>
      <span class="bowl-economy">${economy}</span>
    `;

    bowlingRowsEl.appendChild(row);
  });
}

// Event listeners for scorecard
document.addEventListener("DOMContentLoaded", function () {
  const showScorecardBtn = document.getElementById("show-scorecard");
  const closeScorecardBtn = document.getElementById("close-scorecard");
  const viewScorecardBtn = document.getElementById("view-scorecard-btn");
  const closeResultBtn = document.getElementById("close-result-btn");

  if (showScorecardBtn) {
    showScorecardBtn.addEventListener("click", showScorecard);
  }

  if (closeScorecardBtn) {
    closeScorecardBtn.addEventListener("click", closeScorecard);
  }

  if (viewScorecardBtn) {
    viewScorecardBtn.addEventListener("click", () => {
      closeMatchResult();
      showScorecard();
    });
  }

  if (closeResultBtn) {
    closeResultBtn.addEventListener("click", closeMatchResult);
  }
});

// Global function to close match result popup
function closeMatchResult() {
  const overlay = document.getElementById("match-result-overlay");
  if (overlay) {
    overlay.style.display = "none";
  }
}

// Close popup when clicking outside of it
document.addEventListener("DOMContentLoaded", function () {
  const overlay = document.getElementById("match-result-overlay");
  if (overlay) {
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) {
        closeMatchResult();
      }
    });
  }
});
