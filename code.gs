/** * 🏒 MASTER HOBBY SCOUT - V13.6 (THE COMPOSITE PEDIGREE FIX) 
 * ================================================== 
 * FIXES:
 * 1. COMPOSITE PEDIGREE: The script now scans ALL past seasons (not just the last one)
 * and selects the HIGHEST NHLe found. This fixes the Snuggerud issue.
 * 2. SAMPLE SIZE RULE: Removed the age restriction for the Pedigree check. 
 * If NHL GP < 40, we default to their best historical NHLe if it's better.
 * 3. GHOST TAX / TAGE RULE: Preserved V13.5 Logic.
 */ 

// ========================================== 
// ⚙️ CONFIGURATION 
// ========================================== 
const CURRENT_SEASON = "20252026";  

// NHLe Translation Factors
const NHLE_FACTORS = {
  "KHL": 0.74, "SHL": 0.58, "AHL": 0.47,
  "NCAA": 0.43, "NLA": 0.40, "OHL": 0.32, 
  "WHL": 0.32, "QMJHL": 0.30, "USHL": 0.27
};

const MARKETS = { 
  TIER_S: ["TOR", "MTL", "NYR", "CHI", "EDM", "VAN", "DET"],  
  TIER_A: ["BOS", "PIT", "PHI", "LAK", "NJD", "BUF", "COL", "DAL"],  
  TIER_C: ["CBJ", "NSH", "CAR", "FLA", "ANA", "UTA", "WPG", "SEA"]  
}; 

const TROPHY_CASE = { 
  GODS: ["Connor McDavid", "Connor Bedard", "Sidney Crosby", "Alex Ovechkin"],  
  MVPS: ["Nathan MacKinnon", "Auston Matthews", "Nikita Kucherov", "Leon Draisaitl", "Macklin Celebrini", "Jack Hughes", "Kirill Kaprizov"],
  DEFENSE_KINGS: ["Quinn Hughes", "Cale Makar", "Adam Fox"],
  DEFENSE_CORE: ["Miro Heiskanen", "Roman Josi", "Rasmus Dahlin", "Josh Morrissey", "Evan Bouchard", "Victor Hedman"]
}; 

// ========================================== 
// 🚀 MAIN EXECUTION 
// ========================================== 
function onOpen() { 
  SpreadsheetApp.getUi().createMenu('🏒 Scout V13.6') 
      .addItem('🔄 Run Valuation V13.6', 'runMasterScout') 
      .addToUi(); 
} 

function runMasterScout() {  
  var startTime = new Date().getTime();  
  var ss = SpreadsheetApp.getActiveSpreadsheet();  
  var sheet = ss.getSheetByName("Hobby_Rankings");  
  if (!sheet) { sheet = ss.insertSheet("Hobby_Rankings"); }  

  var HEADER = [  
    "Season", "PlayerID", "Name", "Team", "Pos", "Age", "Draft Year", "Pick", 
    "GP", "G", "A", "PTS", "Pace82", "Peak Pedigree", "Weighted Pts",  
    "Hobby Score", "Tier", "Asset Class", "Flags", "Headshot"  
  ];  

  sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]) 
       .setFontWeight("bold").setBackground("#000000").setFontColor("#ffffff");  
  sheet.setFrozenRows(1);  

  var lastRow = sheet.getLastRow();  
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, HEADER.length).clearContent();  

  Logger.log("Fetching Live Stats...");  
   
  var statsUrl = "https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=false&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D%5D&start=0&limit=-1&cayenneExp=gameTypeId=2%20and%20seasonId=" + CURRENT_SEASON;  
  var statsData = fetchJson(statsUrl).data || [];  

  var batchRows = [];

  var totalPlayerCount = statsData.length;  
   
  for (var k = 0; k < statsData.length; k++) {
    if (k % 50 == 0) {
      Logger.log(`Processed Players (${k+1}/${totalPlayerCount})...`);
    }
     
    if (new Date().getTime() - startTime > 600000) {  
      Logger.log("⏳ Time Limit Reached."); 
      break;  
    }  

    var p = statsData[k];  
    if (p.positionCode === 'G') continue;  

    var id = p.playerId; 
    var name = p.skaterFullName; 
    var team = p.teamAbbrevs || "FA"; 
    var pos = p.positionCode; 
    var gp = p.gamesPlayed || 0; 
    var pts = p.points || 0; 
    var goals = p.goals || 0; 
    var assists = p.assists || 0; 

    if (gp < 1 && pts < 1) continue; 

    // --- BIO & PEDIGREE LOOKUP --- 
    var draftPick = 999; 
    var draftYear = 0; 
    var age = 27;  
    var careerGP = gp; 
    var careerGoals = goals; 
    var careerPts = pts; 
    
    // [UPDATED] Initialize with safe defaults
    var pedigreeStats = { league: "None", nhle: 0 };
     
    // Fetch Bio if: Good stats, OR Low GP (Prospect check), OR Draft Pedigree suspect
    // [FIX] Increased GP check to 82 to catch all rookies/sophomores
    if (pts > 5 || gp < 82 || p.faceoffWinPctg > 0) { 
      var bio = fetchPlayerBio(id); 
      draftPick = bio.pick; 
      draftYear = bio.year; 
      age = bio.age; 
      careerGP = bio.careerGP; 
      careerGoals = bio.careerGoals; 
      careerPts = bio.careerPts; 
      pedigreeStats = bio.pedigreeStats; 
    } 

    var valuation = calculateUniversalScoreV13(name, team, pos, age, draftPick, draftYear, gp, goals, assists, pts, careerGP, careerGoals, careerPts, pedigreeStats); 

    batchRows.push([  
      CURRENT_SEASON, id, name, team, pos, age, draftYear, draftPick, 
      gp, goals, assists, pts, valuation.pace, valuation.nhle, Math.round(valuation.weightedPts), 
      valuation.score,  
      valuation.tier,  
      valuation.assetClass,  
      valuation.flags,  
      "https://assets.nhle.com/mugs/nhl/latest/" + id + ".png"  
    ]);  

    if (batchRows.length >= 50) {  
      writeBatch(sheet, batchRows, k - 50 + 3);  
      batchRows = [];  
    }  
  }  
  if (batchRows.length > 0) writeBatch(sheet, batchRows, totalPlayerCount - batchRows.length + 2);
  sheet.autoResizeColumns(1, HEADER.length);  
}  

// ==========================================  
// 🧠 V13.6 ENGINE: THE COMPOSITE FIX 
// ==========================================  
function calculateUniversalScoreV13(name, team, pos, age, draft, draftYear, gp, g, a, pts, careerGP, careerG, careerPts, pedigree) { 
   
  var score = 40;  
  var assetClass = "Standard"; 
  var flags = []; 

  // --- 1. CALCULATE PACE (NHL) --- 
  var paceDivisor = Math.max(gp, 5); 
  if (age > 24 && gp < 15) paceDivisor = 25;
  var multiplier = 82 / paceDivisor; 
  var paceG = g * multiplier; 
  var paceA = a * multiplier; 
  var pacePts = paceG + paceA; 

  // --- 2. PEDIGREE OVERRIDE (COMPOSITE CHECK) ---
  var effectivePacePts = pacePts;
  
  // [FIX] Rule: "Players that don't have a big enough NHL sample size regardless of age"
  // If GP < 40 (Half a season), we assume Sample Size is too small.
  // We check if their Peak Pedigree (Best NHLe) is higher than their current pace.
  if (gp < 40 && pedigree.league !== "None") {
     if (pedigree.nhle > pacePts) {
        effectivePacePts = pedigree.nhle;
        
        // Hype Multiplier for Top Picks
        if (draft <= 32) effectivePacePts = effectivePacePts * 1.25;
        
        flags.push("🔰 NHLe Boost (" + pedigree.league + ")");
     }
  }

  // --- 3. LEGEND CHECKS --- 
  var isFirstBallot = false; 
  if (pos === "D") { if (careerPts > 700 && careerGP > 1000) isFirstBallot = true; } 
  else { if (careerPts > 1200) isFirstBallot = true; } 

  var isLegacy = false; 
  if (!isFirstBallot) { 
    if (pos === "D") { if (careerGP > 900 || careerPts > 600) isLegacy = true; }  
    else { if (careerGP > 1000 || careerPts > 900) isLegacy = true; } 
  } 

  var isDefenseKing = TROPHY_CASE.DEFENSE_KINGS.includes(name);
  var isDefenseCore = TROPHY_CASE.DEFENSE_CORE.includes(name);

  // --- 4. IMMUNITY & NUANCE CHECKS --- 
  var isSystemMerchant = (age > 30 && draft > 32);
  
  // SNIPER IMMUNITY (Tage/Kempe)
  var isSniper = (paceG >= 32); 

  var isEliteScorer = ((effectivePacePts >= 85 || isSniper) && !isSystemMerchant); 
   
  var isEliteD = (pos === "D" && (effectivePacePts >= 60 || isDefenseKing || isDefenseCore)); 
  var isPrimePedigree = (draft <= 5 && age <= 28); 
  var isBlueChip = (draft <= 32 && age <= 23);

  var isMarketTeam = MARKETS.TIER_S.includes(team); 
  var isFranchiseFace = (isMarketTeam && effectivePacePts >= 80) || (name === "Quinn Hughes"); 
  var isTrophyDarling = TROPHY_CASE.GODS.includes(name) || TROPHY_CASE.MVPS.includes(name); 

  // --- 5. GHOST IDENTIFICATION --- 
  var isGhost = (age >= 25 && !isEliteScorer && !isFranchiseFace && !isTrophyDarling && !isLegacy && !isFirstBallot && !isEliteD && !isPrimePedigree); 

  // --- 6. ASSIGN ASSET CLASS --- 
  if (isFirstBallot) assetClass = "👑 First Ballot"; 
  else if (isDefenseKing) assetClass = "👑 Defense King"; 
  else if (isTrophyDarling) assetClass = "⭐ Icon"; 
  else if (isPrimePedigree) assetClass = "🌟 Prime Star"; 
  else if (isBlueChip && effectivePacePts > 45) assetClass = "🚀 Top Prospect"; 
  else if (isEliteD) assetClass = "⚡ Elite D"; 
  else if (isFranchiseFace) assetClass = "🦁 Franchise Face"; 
  else if (isLegacy) assetClass = "🛡️ Legacy"; 
  else if (isEliteScorer) assetClass = "⚡ Elite Scorer";  
  else if (isGhost) assetClass = "👻 Ghost"; 
  else if (age <= 23) assetClass = "👶 Prospect";

  // --- 7. VALUE MODIFIERS --- 
  var weightG = (pos === "D") ? 2.0 : 1.5;
  var weightA = (pos === "D") ? 1.2 : 1.0;
  
  var ratioG = (pacePts > 0) ? (paceG / pacePts) : 0.4;
  var calcG = effectivePacePts * ratioG;
  var calcA = effectivePacePts * (1 - ratioG);
  
  var weightedPts = (calcG * weightG) + (calcA * weightA); 

  // PROGRESSIVE GHOST TAX
  if (isGhost) { 
    if (effectivePacePts >= 55) {
       weightedPts = weightedPts * 0.85; 
       flags.push("Soft Tax");
    } else {
       weightedPts = weightedPts * 0.60; 
       flags.push("Ghost Tax");
    }
    if (MARKETS.TIER_C.includes(team)) weightedPts = weightedPts * 0.9;
  } 
  else if (isFranchiseFace) { 
    weightedPts = weightedPts * 1.2; 
    flags.push("Market Hype"); 
  } 

  // --- 8. THE SCORING LADDER --- 
  if (weightedPts > 20) score = 50;   
  if (weightedPts > 40) score = 60;   
  if (weightedPts > 50) score = 64;   
  if (weightedPts > 60) score = 68;   
  if (weightedPts > 70) score = 72;   
  if (weightedPts > 80) score = 76;   
  if (weightedPts > 90) score = 82;   
  if (weightedPts > 100) score = 86;  
  if (weightedPts > 120) score = 94;  

  // --- 9. OVERRIDES & FLOORS --- 
  if (isFirstBallot) score = Math.max(score, 84);  
  
  if (isBlueChip) {
    if (pedigree.nhle > 35) { score = Math.max(score, 80); flags.push("📈 Prospect Hype"); } 
    else { score = Math.max(score, 72); }
  }

  if (isPrimePedigree) score = Math.max(score, 82);
  if (isLegacy && !isFirstBallot) score = Math.max(score, 78); 

  if (pos === "D") { 
    if (effectivePacePts >= 75) score += 8;  
    else if (effectivePacePts >= 60) score += 5; 
    if (isDefenseKing) { score = Math.max(score, 90); flags.push("👑 Hobby Royalty"); } 
    else if (isDefenseCore) { score = Math.max(score, 82); flags.push("🛡️ Elite Core"); }
    else if (isEliteD) { score = Math.max(score, 80); }
  } 

  // --- 10. FINAL POLISH --- 
  if (TROPHY_CASE.GODS.includes(name)) score += 4; 
  if (score > 99) score = 99; 
  if (score < 40) score = 40;  

  var tier = "Junk Wax"; 
  if (score >= 96) tier = "👑 GRAIL"; 
  else if (score >= 90) tier = "💎 FRANCHISE"; 
  else if (score >= 84) tier = "🔥 ELITE"; 
  else if (score >= 76) tier = "⭐ STAR";  
  else if (score >= 68) tier = "✅ ROSTER";  
  else if (score >= 60) tier = "📦 COMMON"; 
  else tier = "🗑️ JUNK"; 

  return {  
    score: Math.round(score),  
    tier: tier,  
    assetClass: assetClass, 
    flags: flags.join(", "),  
    pace: Math.round(pacePts), 
    nhle: Math.round(pedigree.nhle),
    weightedPts: Math.round(weightedPts) 
  }; 
} 

// ==========================================  
// 🛠️ HELPERS (The Composite Scanner)
// ==========================================  
function fetchPlayerBio(id) { 
  try { 
    var url = "https://api-web.nhle.com/v1/player/" + id + "/landing"; 
    var data = fetchJson(url); 
    var pick = data.draftDetails ? data.draftDetails.overallPick : 999; 
    var year = data.draftDetails ? data.draftDetails.year : 0; 
    var birthDate = data.birthDate;  
    var age = birthDate ? Math.floor((new Date() - new Date(birthDate))/31557600000) : 27; 
    var careerGP = data.careerTotals?.regularSeason?.gamesPlayed || 0; 
    var careerGoals = data.careerTotals?.regularSeason?.goals || 0; 
    var careerPts = data.careerTotals?.regularSeason?.points || 0; 

    // [UPDATED] FULL HISTORY SCANNER
    var seasonTotals = data.seasonTotals || [];
    var maxNHLe = 0;
    var bestLeague = "None";

    // Loop through ALL seasons to find the "Peak Pedigree"
    for (var i = 0; i < seasonTotals.length; i++) {
       var s = seasonTotals[i];
       if (s.leagueAbbrev !== "NHL" && NHLE_FACTORS[s.leagueAbbrev]) {
          // Filter out insignificant stints (< 10 games) so we don't calculate weird averages
          if (s.gamesPlayed > 10) {
              var factor = NHLE_FACTORS[s.leagueAbbrev];
              var ppg = (s.points / s.gamesPlayed);
              var projected = ppg * factor * 82;
              
              // We want the HIGHEST potential shown in their history
              if (projected > maxNHLe) {
                  maxNHLe = projected;
                  bestLeague = s.leagueAbbrev;
              }
          }
       }
    }
    
    // Return the BEST result found
    var pedigreeStats = { league: bestLeague, nhle: maxNHLe };

    return { pick: pick, year: year, age: age, careerGP: careerGP, careerGoals: careerGoals, careerPts: careerPts, pedigreeStats: pedigreeStats }; 
  } catch(e) { 
    return { pick: 999, year: 0, age: 27, careerGP: 0, careerGoals: 0, careerPts: 0, pedigreeStats: {league:"None", nhle:0} }; 
  } 
}

function writeBatch(sheet, rows, index) {
  if (rows.length === 0) return;

  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();


  // Write new data starting at the passed index
  sheet.getRange(index, 1, rows.length, rows[0].length).setValues(rows);
}
 
function fetchJson(url) {  
  try { return JSON.parse(UrlFetchApp.fetch(url, {'muteHttpExceptions': true}).getContentText()); } 
  catch(e) { return {data:[]}; }  
}
