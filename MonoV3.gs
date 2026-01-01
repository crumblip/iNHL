/**
 * 🏒 MASTER SCOUT V23.2 - THE MONOLITH (TRUE VALUE + HOBBY FIX)
 * =======================================================
 * 1. 🏟️ MARKET GRAVITY: Young stars in Tier S markets get a multiplier boost.
 * 2. 🦄 POWER FORWARD: Lower hit thresholds for forwards who also score.
 * 3. 🧮 TRUE EV ENGINE: Weighted production + Regression + Passenger Tax.
 * 4. 🎨 HOBBY ENGINE V2: True Pace (Goals vs Assists) + Smoothed Regression.
 */

// ==========================================
// ⚙️ CONFIGURATION
// ==========================================
const CURRENT_SEASON = "20252026";
const ROOKIE_DRAFT_YEAR = 2025;

const BUY_THRESHOLD = -12; 
const SELL_THRESHOLD = +15;

const NHLE_FACTORS = {
  "KHL": 0.76, "SHL": 0.55, "AHL": 0.45, "NCAA": 0.41, "NLA": 0.38, 
  "OHL": 0.30, "WHL": 0.30, "QMJHL": 0.28, "USHL": 0.25, "MHL": 0.20
};

const MARKETS = { 
  TIER_S: ["TOR", "MTL", "NYR", "CHI", "DET", "BOS"], 
  TIER_A: ["EDM", "VAN", "LAK", "PHI", "PIT", "BUF", "COL", "MIN", "NJD", "DAL"]
};

// ========================================== 
// 🚀 MAIN EXECUTION
// ========================================== 
function onOpen() { 
  SpreadsheetApp.getUi().createMenu('🏒 Monolith V23') 
      .addItem('🚀 Run Full Analysis', 'runMonolithScout') 
      .addItem('🧹 Clear Cache', 'clearBioCache')
      .addToUi();
} 

function runMonolithScout() {  
  var ss = SpreadsheetApp.getActiveSpreadsheet();  
  var sheet = ss.getSheetByName("Monolith_Rankings");
  if (!sheet) { sheet = ss.insertSheet("Monolith_Rankings"); }  

  // --- FIXED HEADERS ---
  var HEADER = [  
    "PLAYER BIO", "", "", "", "", "", // A-F
    "⚖️ THE VERDICT", "Action", "Confidence", // G-I
    "🎨 HOBBY", "Asset Class", "Flags", "Score", // J-M
    "🧮 MATH", "Δ Diff", "EV OFF", "Base EV", // N-Q
    "Pace", "Headshot" // R-S
  ];

  sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]) 
        .setFontWeight("bold").setBackground("#000000").setFontColor("#00ff00"); 
  sheet.setFrozenRows(1);

  sheet.getRange(2, 1, 1, 6).setValues([["Name", "Team", "Pos", "Age", "Draft", "GP"]]).setFontWeight("bold");
  sheet.getRange(2, 10, 1, 4).setValues([["Tier", "Class", "Flags", "Score"]]).setFontWeight("bold");
  sheet.getRange(2, 14, 1, 4).setValues([["Signal", "Delta", "Curr", "Base"]]).setFontWeight("bold");

  var lastRow = sheet.getLastRow();
  if (lastRow > 2) sheet.getRange(3, 1, lastRow - 2, HEADER.length).clearContent();  

  // --- LOAD DATA ---
  var cacheData = loadCache(ss);
  var cacheUpdates = [];

  Logger.log("📡 Fetching Data Streams...");
  var sumData = fetchJson("https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=false&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D%5D&start=0&limit=-1&cayenneExp=gameTypeId=2%20and%20seasonId=" + CURRENT_SEASON).data || [];
  var rtMap = mapData(fetchJson("https://api.nhle.com/stats/rest/en/skater/realtime?isAggregate=false&isGame=false&start=0&limit=-1&cayenneExp=gameTypeId=2%20and%20seasonId=" + CURRENT_SEASON).data || []);
  var ppMap = mapData(fetchJson("https://api.nhle.com/stats/rest/en/skater/powerplay?isAggregate=false&isGame=false&start=0&limit=-1&cayenneExp=gameTypeId=2%20and%20seasonId=" + CURRENT_SEASON).data || []);

  var batchRows = [];
  var startTime = new Date().getTime();

  for (var k = 0; k < sumData.length; k++) {
    if (new Date().getTime() - startTime > 320000) { Logger.log("⏳ Time Limit"); break; }

    var s = sumData[k];
    if (s.positionCode === 'G') continue;
    if (s.gamesPlayed < 1 && s.points < 1) continue; 

    var pid = s.playerId;
    var rt = rtMap[pid] || {};
    var pp = ppMap[pid] || {};

    // --- 1. FULL BIO FETCH ---
    var bio;
    if (cacheData[pid]) {
        bio = cacheData[pid];
    } else {
        bio = fetchFullBio(pid); 
        cacheData[pid] = bio;
        cacheUpdates.push([pid, JSON.stringify(bio)]);
    }
    
    // --- 2. BANGER DATA ---
    var hits = s.hits || 0;
    var blocks = s.blockedShots || 0;
    var currentTOI = s.timeOnIcePerGame ? (s.timeOnIcePerGame / 60) : 15;

    // --- 3. HOBBY ENGINE (V23.2 - Separated Pace + Smooth Regression) ---
    var hobbyVal = calculateHobbyScoreV2(
        s.skaterFullName, s.teamAbbrevs, s.positionCode, bio.age, bio.pick, bio.year, 
        s.gamesPlayed, s.goals, s.assists, s.points, hits, blocks, currentTOI,
        bio.careerGP, bio.careerPts, bio.pedigreeStats, bio.awards
    );

    // --- 4. MATH ENGINE (V23.1 - True EV + Passenger Tax) ---
    var mathVal = calculateContextMath(
        s.gamesPlayed, s.goals, s.assists, s.points, pp.ppPoints || 0, s.plusMinus, s.positionCode,
        bio.careerGP, bio.careerPts, bio.careerPPP, bio.careerPlusMinus, bio.pedigreeStats.nhle,
        currentTOI, bio.age
    );

    // --- 5. VERDICT SYNTHESIS ---
    var verdict = "Hold"; var action = "—";
    var confidence = "Low";

    // GOLDEN BOY / CULT HERO OVERRIDE
    if (hobbyVal.flags.includes("👑 Top 5") || hobbyVal.flags.includes("🏟️ Cult Hero")) {
         verdict = "💎 UNTOUCHABLE";
         action = "🛡️ HOLD"; confidence = "Max";
    }
    else if (mathVal.signal === "🟢 BUY" || mathVal.signal === "🔥 ROOKIE" || mathVal.signal === "🚀 BREAKOUT") {
        if (mathVal.signal === "🚀 BREAKOUT") { verdict = "💎 NEW TIER"; action = "🛡️ HOLD"; confidence = "High"; } 
        else if (hobbyVal.tier === "👑 GRAIL" || hobbyVal.tier === "💎 FRANCHISE") { verdict = "🚨 ELITE DISCOUNT"; action = "💰 ALL IN"; confidence = "High"; }
        else if (hobbyVal.assetClass === "🏗️ Core Pillar") { verdict = "📈 VALUE PLAY"; action = "⚖️ ACCUMULATE"; confidence = "Med"; }
        else if (mathVal.signal === "🔥 ROOKIE") { verdict = "👶 ROOKIE GEM"; action = "⚡ SPECULATE"; confidence = "Med"; }
        else { verdict = "📉 DIP BUY"; action = "👀 WATCH"; confidence = "Low"; }
    }
    else if (mathVal.signal === "🔴 SELL" || mathVal.signal === "⚠️ BUST?" || mathVal.signal === "⚠️ SLOW START") {
         if (mathVal.signal === "⚠️ SLOW START" && (hobbyVal.flags.includes("Draft") || bio.age < 22)) {
             verdict = "🌱 LOADING..."; action = "🛡️ HOLD"; confidence = "High";
         }
         else if (mathVal.signal === "⚠️ BUST?" && (hobbyVal.tier === "💎 FRANCHISE" || hobbyVal.assetClass === "🏗️ Core Pillar")) {
             verdict = "⏳ PATIENCE"; action = "🛡️ HOLD"; confidence = "High";
         }
         else if (hobbyVal.tier === "📦 COMMON") { verdict = "🗑️ JUNK"; action = "🚫 AVOID"; confidence = "High"; }
         else { verdict = "💎 SELL PEAK"; action = "⚖️ TRIM"; confidence = "Med"; } 
    }
    else if (mathVal.signal === "📉 DEMOTED") {
         verdict = "💀 ROLE LOSS"; action = "🏃 EXIT"; confidence = "High";
    }
    else {
         if (hobbyVal.tier === "🔥 ELITE" || hobbyVal.tier === "👑 GRAIL") { verdict = "🔒 CORE ASSET"; action = "🛡️ HOLD"; confidence = "High"; }
         else { verdict = "✅ ROSTER"; action = "—"; }
    }

    // --- DATA MAPPING ---
    batchRows.push([
      s.skaterFullName, s.teamAbbrevs, s.positionCode, bio.age, bio.year, s.gamesPlayed,
      verdict, action, confidence,
      hobbyVal.tier, hobbyVal.assetClass, hobbyVal.flags, hobbyVal.score, 
      mathVal.signal, mathVal.delta, mathVal.currEV, mathVal.baseEV, 
      hobbyVal.pace + "pts",
      "https://assets.nhle.com/mugs/nhl/latest/" + pid + ".png"
    ]);

    if (batchRows.length >= 50) {
      writeBatch(sheet, batchRows);
      batchRows = [];
    }
  }
  
  if (batchRows.length > 0) writeBatch(sheet, batchRows);
  if (cacheUpdates.length > 0) saveCacheBatch(ss, cacheUpdates);
}

// ==========================================  
// 🧠 ENGINE 1: HOBBY LOGIC (V23.2 - SEPARATED PACE + SMOOTH REGRESSION)
// ==========================================  
function calculateHobbyScoreV2(name, team, pos, age, draft, draftYear, gp, g, a, pts, hits, blocks, toi, careerGP, careerPts, pedigree, awards) {
  
  var score = 40; // Base Score
  var assetClass = "Standard"; 
  var flags = []; 
  var tier = "Junk";

  // --- 0. LEGACY BONUS ---
  var majorHW = 0; var cups = 0;
  if(awards) {
    awards.forEach(aw => {
        var n = aw.trophy.default;
        if (n.includes("Stanley")) cups++;
        if (n.includes("Hart") || n.includes("Art Ross") || n.includes("Norris") || n.includes("Calder")) majorHW++;
    });
  }

  // --- 1. SMOOTHED PACE LOGIC (No More Cliffs) ---
  // We add "Phantom Games" to the denominator to regress small samples.
  // As GP increases, the Phantom Games matter less.
  var phantomGames = 15;
  
  // Calculate Baseline Rates (Career or Pedigree) for the Phantom Games
  // Since we don't have Career Goals passed in, we assume a standard 35/65 split for the BASELINE only.
  var basePace = (careerGP > 82) ? (careerPts / careerGP) * 82 : pedigree.nhle;
  var baseG_Rate = (basePace * 0.35) / 82; 
  var baseA_Rate = (basePace * 0.65) / 82;

  // Calculate Regressed Pace (Actual Stats + Phantom Stats) / (Actual GP + Phantom GP)
  var regGoals = ((g + (phantomGames * baseG_Rate)) / (gp + phantomGames)) * 82;
  var regAssists = ((a + (phantomGames * baseA_Rate)) / (gp + phantomGames)) * 82;

  // Visual Pace (for the UI label only)
  var displayPace = (pts / Math.max(gp, 1)) * 82;

  // --- 2. WEIGHTED SCORING (Snipers vs Playmakers) ---
  // D-Men weights tuned down to prevent "Lucky Shooter" bias
  var wG = (pos==="D") ? 2.5 : 2.2; // Goals (Lowered from 3.0 for D)
  var wA = (pos==="D") ? 1.0 : 1.0; // Assists (Slight bump for D)
  
  // The Core Hobby Value Calculation
  var wPts = (regGoals * wG) + (regAssists * wA); 

  var isYoung = (age <= 24);

  // --- 3. PHYSICALITY & ROLES ---
  var hitRate = hits / Math.max(gp, 1);
  var bangerRate = (hits + blocks) / Math.max(gp, 1);
  var bangerBonus = 0;

  // The Sheriff (Defense/Elite Bashers)
  if (bangerRate > 3.0) bangerBonus = 3;
  if (bangerRate > 4.5) { bangerBonus = 7; flags.push("🥊 Sheriff"); }

  // 🦄 The Power Forward (The Knies Rule)
  // Forward + Hits + Actual Production
  if (pos !== "D" && hitRate > 1.8 && wPts > 45) {
      bangerBonus += 5;
      flags.push("🦄 PWF");
      assetClass = "🏗️ Core Pillar";
  }

  // Workhorse D-Man
  var toiBonus = 0;
  if (pos === "D" && toi > 23.0) { toiBonus = 5; flags.push("🐴 Workhorse"); }

  // --- 4. SCORING BONUSES ---
  if (isYoung && wPts > 60) { score += 5; assetClass = "🏗️ Core Pillar"; }
  if (isYoung && wPts > 85) { score += 5; assetClass = "💎 Franchise"; flags.push("⚡ Prime"); }
  
  // --- 5. MARKET GRAVITY (The Leafs Tax) ---
  if (MARKETS.TIER_S.includes(team)) {
      score += 4;
      // CULT HERO MODIFIER:
      // Young + Tier S + Good Pace
      if (isYoung && wPts > 42) {
          score += 8;
          flags.push("🏟️ Cult Hero");
      }
  }

  // --- 6. PEDIGREE & LEGACY ---
  if (draftYear == ROOKIE_DRAFT_YEAR) { score = Math.max(score, 75); flags.push("🔥 RC"); assetClass = "👶 Rookie"; }
  if (cups > 0) score += 3;

  // Base Curve
  score = (wPts > 50) ? 60 + ((wPts - 60)/2.2) : 60 - ((60 - wPts)/2);
  
  // Apply Flat Bonuses
  score += bangerBonus;
  score += toiBonus;

  if (majorHW > 0) { score += (majorHW * 4); flags.push("🏆 LEGACY"); }

  // Golden Boy Bonus (Top 5 Draft)
  // CHANGED: Instead of a hard floor (min 88), we give a massive bonus.
  // This allows busts to fall, but keeps them "interesting".
  if (draft <= 5 && age <= 22) {
      score += 12; 
      flags.push("👑 Top 5"); 
      if (score > 80) assetClass = "💎 Blue Chip";
  }

  // --- 7. FINAL TIERS ---
  score = Math.min(99, Math.max(40, Math.round(score)));
  
  if (score >= 95) tier = "👑 GRAIL";
  else if (score >= 88) tier = "💎 FRANCHISE";
  else if (score >= 80) tier = "🔥 ELITE";
  else if (score >= 70) tier = "⭐ STAR";
  else tier = "📦 COMMON";

  return { score: score, tier: tier, assetClass: assetClass, flags: flags.join(" "), pace: Math.round(displayPace) };
}

// ==========================================  
// 🧠 ENGINE 2: MATH LOGIC (V23.1 - TRUE VALUE + PASSENGER TAX)
// ==========================================  
function calculateContextMath(gp, g, a, pts, ppp, pm, pos, cGP, cPts, cPPP, cPM, nhle, currentTOI, age) {
    // Filter out minimal data
    if (gp < 5) return { signal: "—", delta: 0, currEV: 0, baseEV: 0 };

    // CALCULATE TRUE SEASON PERFORMANCE
    var currEV = calculateTrueEV(gp, g, a, ppp, pm, pos);
    
    // --- BRANCH A: ESTABLISHED (GP > 82) ---
    if (cGP > 82) {
        // Calculate Base using career averages (approximate G/A split since we only have cPts)
        // We assume a standard 35% Goal / 65% Assist split for the baseline
        var baseG = (cPts * 0.35);
        var baseA = (cPts * 0.65);
        
        var baseEV = calculateTrueEV(cGP, baseG, baseA, cPPP, cPM, pos);
        
        var delta = Math.round(currEV - baseEV);
        var signal = "—";

        // Demotion Logic (High Base, Low Minutes)
        if (baseEV > 85 && currentTOI < 15.0) {
             return { signal: "📉 DEMOTED", delta: delta, currEV: Math.round(currEV), baseEV: Math.round(baseEV) };
        }

        // Buy/Sell Logic
        if (delta >= 12) { // Tightened threshold
            if (age <= 23) signal = "🚀 BREAKOUT";
            else signal = "🔴 SELL"; // Selling the hot streak
        }
        else if (delta <= -12) signal = "🟢 BUY"; // Buying the cold streak
        else if (delta > 5) signal = "Heating";

        return { signal: signal, delta: delta, currEV: Math.round(currEV), baseEV: Math.round(baseEV) };
    } 
    
    // --- BRANCH B: ROOKIES / PROSPECTS (<82 GP) ---
    else {
        // Project their NHLe into a simplified EV score
        var expG = (nhle * 0.35);
        var expA = (nhle * 0.65);
        var expEV = calculateTrueEV(82, expG, expA, nhle * 0.25, 0, pos); 
        
        var delta = Math.round(currEV - expEV);
        var signal = "—";

        if (currEV > 75 && delta > 10) signal = "🔥 ROOKIE";
        else if (delta < -15) {
             if (gp < 40) signal = "⚠️ SLOW START";
             else signal = "⚠️ BUST?"; 
        }

        return { signal: signal, delta: delta, currEV: Math.round(currEV), baseEV: Math.round(expEV) + " (Exp)" };
    }
}

/**
 * THE NEW ENGINE (V23.1)
 * Features: Weighted Production + Regression + "Passenger Tax" on Secondary Assists
 */
function calculateTrueEV(gp, g, a, ppp, pm, pos) {
    if (gp === 0) return 40;

    // --- 1. DEFINE WEIGHTS ---
    var wG = 1.0;   // Goals are the gold standard
    var wPM = 0.10; // Small bump for +/-
    var wP = -0.25; // PP Tax (Discount points gained on PP)
    
    // POSITIONAL BIAS:
    // Defensemen assists are often less "causal" (D-to-D passes) than Forward assists.
    // D-men get 0.55 per Assist, Forwards get 0.70
    var baseWa = (pos === 'D') ? 0.55 : 0.70;

    // --- 2. THE PASSENGER TAX (Secondary Assist Filter) ---
    // If a player has > 3x more Assists than Goals, we assume the excess is "Noise" (Secondary Assists).
    // Example: 2 G, 20 A. 
    // "Prime Assists" = 6 (3x Goals). "Junk Assists" = 14.
    // Junk Assists get a 50% penalty.
    
    var effectiveA = a;
    var goalFloor = Math.max(g, 1); // Safety check: prevent division by zero
    
    if ((a / goalFloor) > 3.0) {
        var primeAssists = goalFloor * 3.0; // These are considered "High Quality"
        var junkAssists = a - primeAssists; // These are considered "Secondary/Luck"
        
        // We discount the junk assists by 50%
        effectiveA = primeAssists + (junkAssists * 0.5); 
    }

    // --- 3. CALCULATE PRODUCTION SCORE ---
    var prodScore = (g * wG) + (effectiveA * baseWa) + (ppp * wP) + (pm * wPM);

    // --- 4. REGRESSION TO MEAN ---
    // Add 12 games of "Average" production to dampen small sample sizes
    var dummyGames = 12;
    var leagueAvgRate = 0.45; 
    
    var regressedRate = (prodScore + (dummyGames * leagueAvgRate)) / (gp + dummyGames);

    // --- 5. SCALING TO 0-99 ---
    // Benchmark: 1.30+ Rate = 99. 0.3 Rate = ~50.
    var score = 35 + (regressedRate * 48); 

    return Math.min(99, Math.max(20, Math.round(score)));
}

// ==========================================  
// 🛠️ HELPERS
// ==========================================  
function fetchFullBio(id) {
    try {
        var url = "https://api-web.nhle.com/v1/player/" + id + "/landing";
        var data = JSON.parse(UrlFetchApp.fetch(url, {'muteHttpExceptions': true}).getContentText());
        
        var birthDate = data.birthDate;  
        var age = birthDate ? Math.floor((new Date() - new Date(birthDate))/31557600000) : 25;
        var pick = data.draftDetails ? data.draftDetails.overallPick : 999;
        var year = data.draftDetails ? data.draftDetails.year : 0;
        
        var t = { gp:0, pts:0, ppp:0, pm:0 };
        if(data.featuredStats && data.featuredStats.regularSeason && data.featuredStats.regularSeason.career) {
            var c = data.featuredStats.regularSeason.career;
            t.gp = c.gamesPlayed; t.pts = c.points; t.ppp = c.powerPlayPoints; t.pm = c.plusMinus;
        }

        var maxNHLe = 30;
        if (data.seasonTotals) {
             data.seasonTotals.forEach(s => {
                 if (NHLE_FACTORS[s.leagueAbbrev] && s.gamesPlayed > 15) {
                     var val = (s.points/s.gamesPlayed) * NHLE_FACTORS[s.leagueAbbrev] * 82;
                     if (val > maxNHLe) maxNHLe = val;
                 }
             });
        }

        return {
            age: age, pick: pick, year: year,
            careerGP: t.gp, careerPts: t.pts, careerPPP: t.ppp, careerPlusMinus: t.pm,
            pedigreeStats: { nhle: maxNHLe }, awards: data.awards || []
        };
    } catch (e) { return { age:25, careerGP:0, pedigreeStats:{nhle:0}, awards:[] }; }
}

function loadCache(ss) {
    var cacheSheet = ss.getSheetByName("MONOLITH_CACHE");
    if (!cacheSheet) return {};
    var data = cacheSheet.getDataRange().getValues();
    var cache = {};
    for (var i = 1; i < data.length; i++) { try { cache[data[i][0]] = JSON.parse(data[i][1]); } catch (e) {} }
    return cache;
}
function saveCacheBatch(ss, rows) {
    var cacheSheet = ss.getSheetByName("MONOLITH_CACHE");
    if (!cacheSheet) { cacheSheet = ss.insertSheet("MONOLITH_CACHE"); cacheSheet.hideSheet(); }
    if (rows.length > 0) cacheSheet.getRange(cacheSheet.getLastRow() + 1, 1, rows.length, 2).setValues(rows);
}
function clearBioCache() { var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("MONOLITH_CACHE"); if (s) s.clear(); }
function mapData(data) { var map = {}; if(data) data.forEach(p => { map[p.playerId] = p; }); return map; }
function writeBatch(sheet, rows) { sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows); }
function fetchJson(url) { try { return JSON.parse(UrlFetchApp.fetch(url, {'muteHttpExceptions': true}).getContentText()); } catch(e) { return {data:[]}; } }
