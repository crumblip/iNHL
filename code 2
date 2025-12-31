/** * 🏒 MASTER HOBBY SCOUT - V14.3 (PURE LOGIC UPDATE)
 * ================================================== 
 * FIXES:
 * 1. REMOVED MVP BYPASS: Deleted the hardcoded MVP list. Separation is now
 * calculated dynamically via the "Prime Production" logic.
 * 2. PRIME PRODUCTION: Players pacing >95 Weighted Pts while under Age 30
 * get a "Hype Boost". This separates Kaprizov (28) from Scheifele (32).
 * 3. SUSTAINABILITY BLEND: Preserved the Geekie/Horvat fix (blending career
 * averages for outliers > Age 26).
 * 4. GOD TIER: Preserved the "Mt. Rushmore" lock for Sid/Ovi/McDavid/Makar.
 */ 

// ========================================== 
// ⚙️ CONFIGURATION 
// ========================================== 
const CURRENT_SEASON = "20252026";

const NHLE_FACTORS = {
  "KHL": 0.76, "SHL": 0.55, "AHL": 0.45,
  "NCAA": 0.41, "NLA": 0.38, "OHL": 0.30, 
  "WHL": 0.30, "QMJHL": 0.28, "USHL": 0.25,
  "MHL": 0.20, "LIIGA": 0.38
};

const MARKETS = { 
  TIER_S: ["TOR", "MTL", "NYR", "CHI", "EDM", "VAN", "DET", "BOS"],  
  TIER_A: ["PIT", "PHI", "LAK", "NJD", "BUF", "COL", "DAL", "MIN"],  
  TIER_C: ["CBJ", "NSH", "CAR", "FLA", "ANA", "UTA", "WPG", "SEA", "TBL", "STL", "WSH", "OTT", "CGY", "NYI", "SJS", "VGK"]  
};

// [UPDATED] Removed MVP List. Only GODS remain as hardcoded exceptions.
const TROPHY_CASE = { 
  GODS: ["Connor McDavid", "Connor Bedard", "Sidney Crosby", "Alex Ovechkin", "Cale Makar"],  
  DEFENSE_KINGS: ["Quinn Hughes", "Adam Fox", "Evan Bouchard", "Miro Heiskanen"],
  DEFENSE_CORE: ["Roman Josi", "Rasmus Dahlin", "Josh Morrissey", "Victor Hedman", "Noah Dobson"]
};

// ========================================== 
// 🚀 MAIN EXECUTION
// ========================================== 
function onOpen() { 
  SpreadsheetApp.getUi().createMenu('🏒 Scout V14.3') 
      .addItem('🔄 Run Valuation V14.3', 'runMasterScout') 
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
    if (k % 50 == 0) Logger.log(`Processed Players (${k+1}/${totalPlayerCount})...`);
     
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
    var pedigreeStats = { league: "None", nhle: 0 };

    // Fetch Bio
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

    var valuation = calculateUniversalScoreV14(name, team, pos, age, draftPick, draftYear, gp, goals, assists, pts, careerGP, careerGoals, careerPts, pedigreeStats);
    
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
// 🧠 V14.3 ENGINE: DYNAMIC HYPE LOGIC
// ==========================================  
function calculateUniversalScoreV14(name, team, pos, age, draft, draftYear, gp, g, a, pts, careerGP, careerG, careerPts, pedigree) { 
   
  // 1. GOD TIER OVERRIDE (The Only Automatic Rule)
  if (TROPHY_CASE.GODS.includes(name)) {
    return { score: 99, tier: "👑 GRAIL", assetClass: "🐐 GOAT", flags: "IMMORTAL", pace: 100, nhle: 0, weightedPts: 1000 };
  }

  var score = 40;
  var assetClass = "Standard"; 
  var flags = []; 
  var tier = "Junk Wax";

  // --- 2. CALCULATE PACE (NHL) --- 
  var paceDivisor = Math.max(gp, 12); 
  var multiplier = 82 / paceDivisor;
  var paceG = g * multiplier; 
  var paceA = a * multiplier; 
  var pacePts = paceG + paceA;

  // --- 3. SUSTAINABILITY BLEND (The Geekie/Horvat Fix) ---
  // If Age > 26 and pacing significantly above career norm, blend it.
  var calculationPaceG = paceG;
  var calculationPaceA = paceA;
  
  if (age > 26 && careerGP > 100) {
      var careerPPG = (careerPts / careerGP) || 0;
      var currentPPG = (pacePts / 82);
      
      // If pacing >30% above career average, regression likely hits
      if (currentPPG > (careerPPG * 1.3)) {
         var blendFactor = 0.7; // 70% Real / 30% History
         var careerG82 = (careerG / careerGP) * 82;
         var careerA82 = ((careerPts - careerG) / careerGP) * 82;
         
         calculationPaceG = (paceG * blendFactor) + (careerG82 * (1 - blendFactor));
         calculationPaceA = (paceA * blendFactor) + (careerA82 * (1 - blendFactor));
         
         flags.push("📉 Regressed");
      }
  }

  // --- 4. PEDIGREE & AGE GATE ---
  var effectivePacePts = calculationPaceG + calculationPaceA;
  var isYoung = (age <= 23);
  
  if (isYoung && pedigree.league !== "None") {
     if (gp < 60 && pedigree.nhle > effectivePacePts) {
         effectivePacePts = pedigree.nhle;
         calculationPaceG = effectivePacePts * 0.4;
         calculationPaceA = effectivePacePts * 0.6;
         flags.push("🔰 NHLe");
     }
  }

  // --- 5. CALCULATE WEIGHTED POINTS ---
  // Goals 2.25x | Assists 0.75x
  var weightG = (pos === "D") ? 3.0 : 2.25;
  var weightA = (pos === "D") ? 1.0 : 0.75;

  var weightedPts = (calculationPaceG * weightG) + (calculationPaceA * weightA);

  // AGE DECAY (Marchand Rule)
  if (age > 34) {
      weightedPts = weightedPts * 0.92; 
  }

  // --- 6. CONTINUOUS SCORING CURVE ---
  // Linear Formula: Score = 60 + ((WeightedPts - 60) / 3)
  if (weightedPts > 50) {
      score = 60 + ((weightedPts - 60) / 3);
  } else {
      score = 60 - ((60 - weightedPts) / 2); 
  }

  // --- 7. DYNAMIC HYPE LOGIC (Replaces MVP List) ---
  // Instead of a hardcoded list, we separate "Stats" from "Hype" using Age + Production.
  
  // Rule: You must be producing Elite numbers to get Hype.
  if (weightedPts > 95) {
      // THE PRIME PREMIUM (Separates Kaprizov from Scheifele)
      if (age <= 29) {
          score += 3; 
          flags.push("⚡ Prime");
      }
      
      // THE YOUTH KICKER (Separates Johnston/Hughes from Prime Stars)
      if (age <= 24) {
          score += 2; 
      }
  }

  // --- 8. BONUSES & OVERRIDES ---
  
  // MARKET BONUS
  var isMarketTeam = MARKETS.TIER_S.includes(team);
  var isMarketGood = MARKETS.TIER_A.includes(team);
  
  if (isMarketTeam) score += 4;
  else if (isMarketGood) score += 2;

  // NEXT ONE (Celebrini Rule) - This remains as it's a specific Prospect Rule
  if (draft === 1 && age <= 19) {
      score = Math.max(score, 94);
      flags.push("💎 HYPE");
  }

  // DEFENSE FLOORS (Makar is already God, this handles Hughes/Fox)
  if (pos === "D") {
      if (TROPHY_CASE.DEFENSE_KINGS.includes(name)) score = Math.max(score, 92);
  }

  // --- 9. FINAL POLISH ---
  if (score > 98) score = 98; 
  if (score < 40) score = 40;

  // ASSIGN TIER
  if (score >= 96) tier = "👑 GRAIL"; 
  else if (score >= 90) tier = "💎 FRANCHISE"; 
  else if (score >= 82) tier = "🔥 ELITE"; 
  else if (score >= 74) tier = "⭐ STAR"; 
  else if (score >= 60) tier = "✅ ROSTER"; 
  else if (score >= 50) tier = "📦 COMMON";
  else tier = "🗑️ JUNK";

  // Asset Class Cleanup
  if (age > 25 && weightedPts < 60) assetClass = "👻 Ghost";
  else if (score >= 90) assetClass = "💎 Franchise";
  else if (score >= 82) assetClass = "🔥 Elite";
  else if (age <= 22 && score > 70) assetClass = "👶 Prospect";

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
// 🛠️ HELPERS
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

    // HISTORY SCANNER (Recent Seasons Only)
    var seasonTotals = data.seasonTotals || [];
    var maxNHLe = 0;
    var bestLeague = "None";
    var currentYear = new Date().getFullYear();

    for (var i = 0; i < seasonTotals.length; i++) {
       var s = seasonTotals[i];
       var seasonStart = Math.floor(s.season / 10000);
       if (currentYear - seasonStart > 4) continue; 

       if (s.leagueAbbrev !== "NHL" && NHLE_FACTORS[s.leagueAbbrev]) {
          if (s.gamesPlayed > 15) {
              var factor = NHLE_FACTORS[s.leagueAbbrev];
              var ppg = (s.points / s.gamesPlayed);
              var projected = ppg * factor * 82;

              if (projected > maxNHLe) {
                  maxNHLe = projected;
                  bestLeague = s.leagueAbbrev;
              }
          }
       }
    }
    
    var pedigreeStats = { league: bestLeague, nhle: maxNHLe };
    return { pick: pick, year: year, age: age, careerGP: careerGP, careerGoals: careerGoals, careerPts: careerPts, pedigreeStats: pedigreeStats };
  } catch(e) { 
    return { pick: 999, year: 0, age: 27, careerGP: 0, careerGoals: 0, careerPts: 0, pedigreeStats: {league:"None", nhle:0} };
  } 
}

function writeBatch(sheet, rows, index) {
  if (rows.length === 0) return;
  sheet.getRange(index, 1, rows.length, rows[0].length).setValues(rows);
}
 
function fetchJson(url) {  
  try { return JSON.parse(UrlFetchApp.fetch(url, {'muteHttpExceptions': true}).getContentText()); } 
  catch(e) { return {data:[]}; }  
}
