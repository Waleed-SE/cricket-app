import json
import os
from datetime import datetime
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum

def serialize_dataclass(obj):
    """Custom serialization to handle enums and other non-JSON types"""
    if hasattr(obj, '__dict__'):
        result = {}
        for key, value in obj.__dict__.items():
            if isinstance(value, Enum):
                result[key] = value.value
            elif hasattr(value, '__dict__'):
                result[key] = serialize_dataclass(value)
            elif isinstance(value, list):
                result[key] = [serialize_dataclass(item) if hasattr(item, '__dict__') else (item.value if isinstance(item, Enum) else item) for item in value]
            else:
                result[key] = value
        return result
    elif isinstance(obj, Enum):
        return obj.value
    else:
        return obj

class WicketType(Enum):
    BOWLED = "bowled"
    CAUGHT = "caught"
    LBW = "lbw"
    RUN_OUT = "run_out"
    STUMPED = "stumped"
    HIT_WICKET = "hit_wicket"
    RETIRED = "retired"

class ExtraType(Enum):
    WIDE = "wide"
    NO_BALL = "no_ball"
    BYE = "bye"
    LEG_BYE = "leg_bye"

@dataclass
class Player:
    name: str
    runs: int = 0
    balls_faced: int = 0
    fours: int = 0
    sixes: int = 0
    overs_bowled: float = 0.0
    runs_conceded: int = 0
    wickets_taken: int = 0
    maidens: int = 0
    
    @property
    def strike_rate(self) -> float:
        return (self.runs / self.balls_faced * 100) if self.balls_faced > 0 else 0.0
    
    @property
    def economy_rate(self) -> float:
        return (self.runs_conceded / self.overs_bowled) if self.overs_bowled > 0 else 0.0
    
    @property
    def average(self) -> float:
        return (self.runs_conceded / self.wickets_taken) if self.wickets_taken > 0 else 0.0

@dataclass
class Ball:
    runs: int = 0
    is_wicket: bool = False
    wicket_type: Optional[WicketType] = None
    dismissed_player: Optional[str] = None
    extra_type: Optional[ExtraType] = None
    extra_runs: int = 0
    bowler: str = ""
    # Store pre-ball state for undo
    prev_striker: Optional[str] = None
    prev_non_striker: Optional[str] = None
    
    @property
    def total_runs(self) -> int:
        return self.runs + self.extra_runs
    
    @property
    def is_legal_delivery(self) -> bool:
        return self.extra_type not in [ExtraType.WIDE, ExtraType.NO_BALL]

@dataclass
class Over:
    over_number: int
    bowler: str
    balls: List[Ball]
    
    @property
    def runs(self) -> int:
        return sum(ball.total_runs for ball in self.balls)
    
    @property
    def wickets(self) -> int:
        return sum(1 for ball in self.balls if ball.is_wicket)
    
    @property
    def legal_balls(self) -> int:
        return sum(1 for ball in self.balls if ball.is_legal_delivery)
    
    @property
    def is_complete(self) -> bool:
        return self.legal_balls >= 6
    
    @property
    def summary(self) -> str:
        """Returns over summary like '1 2 0 W 4 1'"""
        summary = []
        for ball in self.balls:
            if ball.is_wicket:
                summary.append('W')
            elif ball.extra_type == ExtraType.WIDE:
                summary.append(f'Wd{ball.extra_runs}')
            elif ball.extra_type == ExtraType.NO_BALL:
                summary.append(f'Nb{ball.total_runs}')
            elif ball.extra_type in [ExtraType.BYE, ExtraType.LEG_BYE]:
                summary.append(f'{ball.total_runs}b')
            else:
                summary.append(str(ball.runs))
        return ' '.join(summary)

@dataclass
class Partnership:
    batter1: str
    batter2: str
    runs: int = 0
    balls: int = 0
    
    @property
    def run_rate(self) -> float:
        return (self.runs / self.balls * 6) if self.balls > 0 else 0.0

@dataclass
class Team:
    name: str
    players: List[str]
    runs: int = 0
    wickets: int = 0
    overs: float = 0.0
    extras: int = 0
    
    @property
    def run_rate(self) -> float:
        return (self.runs / self.overs) if self.overs > 0 else 0.0

class Match:
    def __init__(self, team1_name: str, team2_name: str, total_overs: int, team1_flag: str = "", team2_flag: str = ""):
        self.id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.team1 = Team(team1_name, [])
        self.team2 = Team(team2_name, [])
        self.team1_flag = team1_flag
        self.team2_flag = team2_flag
        self.total_overs = total_overs
        self.current_innings = 1
        self.toss_winner = ""
        self.toss_decision = ""  # "bat" or "bowl"
        
        # Current match state
        self.batting_team = None
        self.bowling_team = None
        self.striker = ""
        self.non_striker = ""
        self.bowler = ""
        self.current_over = 0
        self.current_ball = 0
        
        # Match data
        self.overs: List[Over] = []
        self.players: Dict[str, Player] = {}
        self.partnerships: List[Partnership] = []
        self.current_partnership = None
        self.fall_of_wickets = []
        
        # Match status
        self.is_started = False
        self.is_finished = False
        self.winner = ""
        self.match_result = ""
        
    def add_player(self, name: str, team: str):
        """Add a player to the match"""
        self.players[name] = Player(name)
        if team.lower() == self.team1.name.lower():
            self.team1.players.append(name)
        else:
            self.team2.players.append(name)
    
    def set_toss(self, winner: str, decision: str):
        """Set toss result"""
        self.toss_winner = winner
        self.toss_decision = decision
        
        if decision == "bat":
            if winner.lower() == self.team1.name.lower():
                self.batting_team = self.team1
                self.bowling_team = self.team2
            else:
                self.batting_team = self.team2
                self.bowling_team = self.team1
        else:
            if winner.lower() == self.team1.name.lower():
                self.batting_team = self.team2
                self.bowling_team = self.team1
            else:
                self.batting_team = self.team1
                self.bowling_team = self.team2
    
    def start_innings(self, striker: str, non_striker: str, bowler: str):
        """Start the innings with opening players"""
        self.striker = striker
        self.non_striker = non_striker
        self.bowler = bowler
        self.current_over = 1
        self.current_ball = 0
        self.is_started = True
        
        # Create first partnership
        self.current_partnership = Partnership(striker, non_striker)
        self.partnerships.append(self.current_partnership)
        
        # Create first over
        self.overs.append(Over(self.current_over, bowler, []))
    
    def add_ball(self, runs: int, is_wicket: bool = False, wicket_type: Optional[WicketType] = None, 
                 dismissed_player: Optional[str] = None, extra_type: Optional[ExtraType] = None, 
                 extra_runs: int = 0) -> Dict[str, Any]:
        """Add a ball to the current over"""
        if not self.is_started:
            return {"error": "Match not started"}
        
        ball = Ball(
            runs=runs,
            is_wicket=is_wicket,
            wicket_type=wicket_type,
            dismissed_player=dismissed_player,
            extra_type=extra_type,
            extra_runs=extra_runs,
            bowler=self.bowler,
            # Store pre-ball state for undo
            prev_striker=self.striker,
            prev_non_striker=self.non_striker
        )
        
        # Add ball to current over
        current_over = self.overs[-1]
        current_over.balls.append(ball)
        
        # Update player stats
        if ball.is_legal_delivery:
            self.players[self.striker].balls_faced += 1
            self.current_partnership.balls += 1
            self.current_ball += 1
        
        # Update runs
        self.players[self.striker].runs += runs
        self.batting_team.runs += ball.total_runs
        self.players[self.bowler].runs_conceded += ball.total_runs
        self.current_partnership.runs += ball.total_runs
        
        # Update boundaries
        if runs == 4:
            self.players[self.striker].fours += 1
        elif runs == 6:
            self.players[self.striker].sixes += 1
        
        # Handle wicket
        wicket_occurred = False
        dismissed_batsman = None
        if is_wicket:
            self.batting_team.wickets += 1
            self.players[self.bowler].wickets_taken += 1
            dismissed_batsman = dismissed_player or self.striker
            self.fall_of_wickets.append({
                "player": dismissed_batsman,
                "runs": self.batting_team.runs,
                "over": f"{self.current_over}.{self.current_ball}",
                "partnership": self.current_partnership.runs
            })
            wicket_occurred = True
        
        # Swap striker on odd runs (if not a wicket)
        if not is_wicket and runs % 2 == 1:
            self.striker, self.non_striker = self.non_striker, self.striker
        
        # Check if over is complete
        if current_over.is_complete:
            self._complete_over()
            
            # Check if innings/match ended after over completion
            if self.is_finished:
                return {"action": "match_complete", "winner": self.winner, "match_result": self.match_result}
            elif hasattr(self, '_innings_just_ended') and self._innings_just_ended:
                self._innings_just_ended = False  # Reset flag
                if wicket_occurred:
                    return {"action": "innings_complete", "new_innings": self.current_innings, "wicket": True, "dismissed": dismissed_batsman}
                else:
                    return {"action": "innings_complete", "new_innings": self.current_innings}
            
            # Normal over complete
            if wicket_occurred:
                return {"action": "over_complete", "wicket": True, "dismissed": dismissed_batsman}
            else:
                return {"action": "over_complete"}
        
        # If wicket but over not complete, ask for new batter
        if wicket_occurred:
            # Check if 10 wickets have fallen (innings ends)
            if self.batting_team.wickets >= 10:
                self._end_innings()
                if self.is_finished:
                    return {"action": "match_complete", "winner": self.winner, "match_result": self.match_result}
                else:
                    return {"action": "innings_complete", "new_innings": self.current_innings}
            return {"action": "wicket", "dismissed": dismissed_batsman}
        
        # Check if target reached in 2nd innings
        if self.current_innings == 2:
            target = self.team1.runs if self.batting_team == self.team2 else self.team2.runs
            if self.batting_team.runs > target:
                self.is_finished = True
                self._determine_winner()
                return {"action": "match_complete", "winner": self.winner, "match_result": self.match_result, "target_reached": True}

        return {"action": "ball_added"}
    
    def undo_last_ball(self) -> Dict[str, Any]:
        """Undo the last ball played"""
        # Check if there are any balls to undo
        if not self.overs or (len(self.overs) == 1 and not self.overs[0].balls):
            return {"success": False, "message": "No balls to undo"}
        
        # Get the current over
        current_over = self.overs[-1]
        
        # If current over has no balls, go to previous over
        if not current_over.balls:
            if len(self.overs) == 1:
                return {"success": False, "message": "No balls to undo"}
            
            # Remove empty over (created for new bowler)
            self.overs.pop()
            
            # Get the previous over (the one that was just completed)
            current_over = self.overs[-1]
            completed_over_bowler = current_over.bowler
            
            # Restore over state
            self.current_over -= 1
            self.current_ball = len(current_over.balls)
            self.batting_team.overs -= 1.0
            
            # Restore the bowler from the completed over
            self.bowler = current_over.bowler
            
            # Revert bowler stats for the completed over
            if completed_over_bowler in self.players:
                self.players[completed_over_bowler].overs_bowled -= 1.0
                
                # Check if the completed over was a maiden and revert maiden count
                # A maiden over has 0 runs and 0 wickets
                if current_over.runs == 0 and current_over.wickets == 0:
                    self.players[completed_over_bowler].maidens -= 1
            
            # Swap batsmen back (they were swapped at end of over)
            self.striker, self.non_striker = self.non_striker, self.striker
        
        # Get the last ball
        last_ball = current_over.balls.pop()
        
        # Reverse the ball effects
        self._reverse_ball_effects(last_ball)
        
        return {"success": True, "message": "Last ball undone successfully"}
    
    def _reverse_ball_effects(self, ball: Ball):
        """Reverse all effects of the given ball"""
        # Reverse runs for striker
        self.players[self.striker].runs -= ball.runs
        
        # Reverse team runs
        self.batting_team.runs -= ball.total_runs
        
        # Reverse bowler runs conceded
        self.players[ball.bowler].runs_conceded -= ball.total_runs
        
        # Reverse current partnership
        self.current_partnership.runs -= ball.total_runs
        
        # Reverse boundaries
        if ball.runs == 4:
            self.players[self.striker].fours -= 1
        elif ball.runs == 6:
            self.players[self.striker].sixes -= 1
        
        # Reverse legal delivery effects
        if ball.is_legal_delivery:
            self.players[self.striker].balls_faced -= 1
            self.current_partnership.balls -= 1
            self.current_ball -= 1
        
        # Reverse wicket effects
        if ball.is_wicket:
            self.batting_team.wickets -= 1
            self.players[ball.bowler].wickets_taken -= 1
            # Remove from fall of wickets
            if self.fall_of_wickets:
                self.fall_of_wickets.pop()
            
            # Restore the batsmen to their pre-wicket state
            if ball.prev_striker and ball.prev_non_striker:
                self.striker = ball.prev_striker
                self.non_striker = ball.prev_non_striker
                
                # Restore the partnership to before the wicket
                # Remove the current partnership (created after wicket) and restore the previous one
                if len(self.partnerships) > 1:
                    self.partnerships.pop()  # Remove partnership created after wicket
                    self.current_partnership = self.partnerships[-1]  # Restore previous partnership
        else:
            # Only reverse striker swap if it wasn't a wicket (odd runs and no wicket)
            if ball.runs % 2 == 1:
                self.striker, self.non_striker = self.non_striker, self.striker
    
    def _complete_over(self):
        """Complete the current over and prepare for next"""
        # Update bowler stats
        self.players[self.bowler].overs_bowled += 1.0
        
        # Check for maiden over
        if self.overs[-1].runs == 0 and self.overs[-1].wickets == 0:
            self.players[self.bowler].maidens += 1
        
        # Swap batsmen
        self.striker, self.non_striker = self.non_striker, self.striker
        
        # Update team overs
        self.batting_team.overs += 1.0
        self.current_over += 1
        self.current_ball = 0
        
        # Check if innings is complete
        if (self.current_over > self.total_overs or 
            self.batting_team.wickets >= 10):
            self._end_innings()
        else:
            # Prepare for next over (bowler will be set externally)
            pass
    
    def _end_innings(self):
        """End the current innings"""
        if self.current_innings == 1:
            # End first innings, start second
            self.current_innings = 2
            self._innings_just_ended = True
            
            # Swap teams
            self.batting_team, self.bowling_team = self.bowling_team, self.batting_team
            
            # Reset for second innings
            self.current_over = 1
            self.current_ball = 0
            self.partnerships = []
            self.fall_of_wickets = []
            
            # Reset bowling team stats for new innings
            self.batting_team.runs = 0
            self.batting_team.wickets = 0
            self.batting_team.overs = 0.0
            
            # Clear current players (will be set when new innings starts)
            self.striker = None
            self.non_striker = None
            self.bowler = None
            
        else:
            # Second innings ended, finish match
            self.is_finished = True
            self._determine_winner()
    
    def start_second_innings(self, striker: str, non_striker: str, bowler: str):
        """Start the second innings with opening players"""
        if self.current_innings != 2:
            raise ValueError("Can only start second innings when current_innings is 2")
        
        self.striker = striker
        self.non_striker = non_striker
        self.bowler = bowler
        
        # Create new partnership
        self.current_partnership = Partnership(striker, non_striker, 0, 0)
        self.partnerships = [self.current_partnership]
        
        # Create first over for second innings
        self.overs = [Over(1, bowler, [])]
        
        return True

    def _determine_winner(self):
        """Determine match winner with proper cricket result format"""
        if self.team1.runs > self.team2.runs:
            self.winner = self.team1.name
            # Check if team1 was chasing (batted second)
            if (self.toss_decision == "bat" and self.toss_winner.lower() == self.team2.name.lower()) or \
               (self.toss_decision == "bowl" and self.toss_winner.lower() == self.team1.name.lower()):
                # Team1 was chasing and won
                wickets_remaining = 10 - self.team1.wickets
                self.match_result = f"{self.team1.name} won by {wickets_remaining} wicket{'s' if wickets_remaining != 1 else ''}"
            else:
                # Team1 batted first and won by runs
                runs_difference = self.team1.runs - self.team2.runs
                self.match_result = f"{self.team1.name} won by {runs_difference} run{'s' if runs_difference != 1 else ''}"
        elif self.team2.runs > self.team1.runs:
            self.winner = self.team2.name
            # Check if team2 was chasing (batted second)
            if (self.toss_decision == "bat" and self.toss_winner.lower() == self.team1.name.lower()) or \
               (self.toss_decision == "bowl" and self.toss_winner.lower() == self.team2.name.lower()):
                # Team2 was chasing and won
                wickets_remaining = 10 - self.team2.wickets
                self.match_result = f"{self.team2.name} won by {wickets_remaining} wicket{'s' if wickets_remaining != 1 else ''}"
            else:
                # Team2 batted first and won by runs
                runs_difference = self.team2.runs - self.team1.runs
                self.match_result = f"{self.team2.name} won by {runs_difference} run{'s' if runs_difference != 1 else ''}"
        else:
            self.winner = "Tie"
            self.match_result = "Match tied"
    
    def set_new_bowler(self, bowler: str):
        """Set new bowler for the next over"""
        self.bowler = bowler
        self.overs.append(Over(self.current_over, bowler, []))
    
    def set_new_batter(self, batter: str):
        """Set new batter after wicket"""
        # Find who was dismissed from the last wicket
        dismissed_player = None
        if self.fall_of_wickets:
            dismissed_player = self.fall_of_wickets[-1]["player"]
        
        # End current partnership
        if self.current_partnership:
            # Determine who stays based on who was dismissed
            if dismissed_player == self.striker:
                # Striker was dismissed, new batter becomes striker, non-striker stays
                staying_player = self.non_striker
                self.striker = batter
            elif dismissed_player == self.non_striker:
                # Non-striker was dismissed, new batter becomes non-striker, striker stays  
                staying_player = self.striker
                self.non_striker = batter
            else:
                # Default behavior if we can't determine (striker was dismissed)
                staying_player = self.non_striker
                self.striker = batter
            
            self.current_partnership = Partnership(staying_player, batter)
            self.partnerships.append(self.current_partnership)
    
    def get_current_status(self) -> Dict[str, Any]:
        """Get current match status for display"""
        current_over_obj = self.overs[-1] if self.overs else None
        
        return {
            "match_id": self.id,
            "team1": serialize_dataclass(self.team1),
            "team2": serialize_dataclass(self.team2),
            "team1_flag": self.team1_flag,
            "team2_flag": self.team2_flag,
            "current_innings": self.current_innings,
            "batting_team": self.batting_team.name if self.batting_team else "",
            "bowling_team": self.bowling_team.name if self.bowling_team else "",
            "toss_winner": self.toss_winner,
            "toss_decision": self.toss_decision,
            "striker": self.striker,
            "non_striker": self.non_striker,
            "bowler": self.bowler,
            "current_over": self.current_over,
            "current_ball": self.current_ball,
            "current_partnership": serialize_dataclass(self.current_partnership) if self.current_partnership else None,
            "last_over_summary": current_over_obj.summary if current_over_obj else "",
            "fall_of_wickets": self.fall_of_wickets,
            "is_started": self.is_started,
            "is_finished": self.is_finished,
            "winner": self.winner,
            "match_result": self.match_result,
            "players": {name: serialize_dataclass(player) for name, player in self.players.items()},
            "total_overs": self.total_overs,
            "overs": [serialize_dataclass(over) for over in self.overs]
        }
    
    def save_to_file(self, filepath: str = None):
        """Save match data to JSON file"""
        if not filepath:
            filepath = f"data/match_{self.id}.json"
        
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        match_data = {
            "match_info": {
                "id": self.id,
                "team1_name": self.team1.name,
                "team2_name": self.team2.name,
                "team1_flag": self.team1_flag,
                "team2_flag": self.team2_flag,
                "total_overs": self.total_overs,
                "toss_winner": self.toss_winner,
                "toss_decision": self.toss_decision,
                "current_innings": self.current_innings,
                "is_started": self.is_started,
                "is_finished": self.is_finished,
                "winner": self.winner,
                "match_result": self.match_result
            },
            "current_state": {
                "batting_team": self.batting_team.name if self.batting_team else "",
                "bowling_team": self.bowling_team.name if self.bowling_team else "",
                "striker": self.striker,
                "non_striker": self.non_striker,
                "bowler": self.bowler,
                "current_over": self.current_over,
                "current_ball": self.current_ball
            },
            "teams": {
                "team1": serialize_dataclass(self.team1),
                "team2": serialize_dataclass(self.team2)
            },
            "players": {name: serialize_dataclass(player) for name, player in self.players.items()},
            "overs": [
                {
                    "over_number": over.over_number,
                    "bowler": over.bowler,
                    "balls": [serialize_dataclass(ball) for ball in over.balls],
                    "summary": over.summary
                }
                for over in self.overs
            ],
            "partnerships": [serialize_dataclass(p) for p in self.partnerships],
            "fall_of_wickets": self.fall_of_wickets
        }
        
        with open(filepath, 'w') as f:
            json.dump(match_data, f, indent=2)
    
    @classmethod
    def load_from_file(cls, filepath: str) -> 'Match':
        """Load match from JSON file"""
        with open(filepath, 'r') as f:
            data = json.load(f)
        
        # Create match instance
        match_info = data["match_info"]
        match = cls(
            match_info["team1_name"],
            match_info["team2_name"],
            match_info["total_overs"],
            match_info.get("team1_flag", ""),
            match_info.get("team2_flag", "")
        )
        
        # Restore match info
        match.id = match_info["id"]
        match.toss_winner = match_info["toss_winner"]
        match.toss_decision = match_info["toss_decision"]
        match.current_innings = match_info["current_innings"]
        match.is_started = match_info["is_started"]
        match.is_finished = match_info["is_finished"]
        match.winner = match_info["winner"]
        match.match_result = match_info.get("match_result", "")
        
        # Restore teams
        team_data = data["teams"]
        match.team1 = Team(**team_data["team1"])
        match.team2 = Team(**team_data["team2"])
        
        # Set batting/bowling teams
        current_state = data["current_state"]
        if current_state["batting_team"] == match.team1.name:
            match.batting_team = match.team1
            match.bowling_team = match.team2
        else:
            match.batting_team = match.team2
            match.bowling_team = match.team1
        
        # Restore current state
        match.striker = current_state["striker"]
        match.non_striker = current_state["non_striker"]
        match.bowler = current_state["bowler"]
        match.current_over = current_state["current_over"]
        match.current_ball = current_state["current_ball"]
        
        # Restore players
        for name, player_data in data["players"].items():
            match.players[name] = Player(**player_data)
        
        # Restore partnerships
        match.partnerships = [Partnership(**p) for p in data["partnerships"]]
        match.current_partnership = match.partnerships[-1] if match.partnerships else None
        
        # Restore fall of wickets
        match.fall_of_wickets = data["fall_of_wickets"]
        
        # Restore overs
        for over_data in data["overs"]:
            balls = []
            for ball_data in over_data["balls"]:
                # Convert enum strings back to enum objects
                if ball_data.get("wicket_type"):
                    ball_data["wicket_type"] = WicketType(ball_data["wicket_type"])
                if ball_data.get("extra_type"):
                    ball_data["extra_type"] = ExtraType(ball_data["extra_type"])
                balls.append(Ball(**ball_data))
            
            over = Over(
                over_data["over_number"],
                over_data["bowler"],
                balls
            )
            match.overs.append(over)
        
        return match