/**
 * 🏒 MASTER SCOUT V22.6 - THE MONOLITH (CULT HERO UPDATE)
 * =======================================================
 * 1. 🏟️ MARKET GRAVITY: Young stars in Tier S markets get a multiplier boost.
 * 2. 🦄 POWER FORWARD: Lower hit thresholds for forwards who also score (The Knies Rule).
 * 3. 🛡️ PROSPECT SHIELD: Still active for <40 GP players.
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
  SpreadsheetApp.getUi().createMenu('🏒 Monolith V22') 
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

    // --- 3. HOBBY ENGINE (Cult Hero Mode) ---
    var hobbyVal = calculateHobbyScoreV2(
        s.skaterFullName, s.teamAbbrevs, s.positionCode, bio.age, bio.pick, bio.year, 
        s.gamesPlayed, s.goals, s.assists, s.points, hits, blocks, currentTOI,
        bio.careerGP, bio.careerPts, bio.pedigreeStats, bio.awards
    );

    // --- 4. MATH ENGINE ---
    var mathVal = calculateContextMath(
        s.gamesPlayed, s.points, pp.ppPoints || 0, s.plusMinus, s.positionCode,
        bio.careerGP, bio.careerPts, bio.careerPPP, bio.careerPlusMinus, bio.pedigreeStats.nhle,
        currentTOI, bio.age
    );

    // --- 5. VERDICT SYNTHESIS ---
    var verdict = "Hold"; var action = "—"; var confidence = "Low";

    // GOLDEN BOY / CULT HERO OVERRIDE
    if (hobbyVal.flags.includes("👑 Top 5") || hobbyVal.flags.includes("🏟️ Cult Hero")) {
         verdict = "💎 UNTOUCHABLE"; action = "🛡️ HOLD"; confidence = "Max";
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
// 🧠 ENGINE 1: HOBBY LOGIC (V22.6 - CULT HERO)
// ==========================================  
function calculateHobbyScoreV2(name, team, pos, age, draft, draftYear, gp, g, a, pts, hits, blocks, toi, careerGP, careerPts, pedigree, awards) {
  
  var score = 40; var assetClass = "Standard"; var flags = []; var tier = "Junk";

  var majorHW = 0; var cups = 0;
  if(awards) {
    awards.forEach(aw => {
        var n = aw.trophy.default;
        if (n.includes("Stanley")) cups++;
        if (n.includes("Hart") || n.includes("Art Ross") || n.includes("Norris") || n.includes("Calder")) majorHW++;
    });
  }

  // --- 1. PACE LOGIC ---
  var rawPace = (pts / Math.max(gp, 1)) * 82;
  var pacePts = rawPace;
  
  if (gp < 40) {
      if (age <= 22) {
          pacePts = Math.max(rawPace, pedigree.nhle);
      } else {
          var baseline = (careerGP > 82) ? (careerPts/careerGP)*82 : pedigree.nhle;
          pacePts = (rawPace * 0.5) + (baseline * 0.5);
      }
  }

  var wG = (pos==="D") ? 3.0 : 2.1; 
  var wA = (pos==="D") ? 0.9 : 1.0;
  var wPts = ((pacePts * 0.35) * wG) + ((pacePts * 0.65) * wA); 

  var isYoung = (age <= 24);
  
  // --- 2. PHYSICALITY & ROLES ---
  var hitRate = hits / Math.max(gp, 1);
  var bangerRate = (hits + blocks) / Math.max(gp, 1);
  var bangerBonus = 0;

  // The Sheriff (Defense/Elite Bashers)
  if (bangerRate > 3.0) bangerBonus = 3;
  if (bangerRate > 4.5) { bangerBonus = 7; flags.push("🥊 Sheriff"); }

  // 🦄 The Power Forward (The Knies Rule)
  // Lower threshold for Forwards who also score points
  if (pos !== "D" && hitRate > 1.8 && wPts > 45) {
      bangerBonus += 5; // Stacks with Sheriff if they are really crazy
      flags.push("🦄 PWF");
      assetClass = "🏗️ Core Pillar";
  }

  // Workhorse D-Man
  var toiBonus = 0;
  if (pos === "D" && toi > 23.0) { toiBonus = 5; flags.push("🐴 Workhorse"); }

  // --- 3. SCORING ---
  if (isYoung && wPts > 60) { score += 5; assetClass = "🏗️ Core Pillar"; }
  if (isYoung && wPts > 85) { score += 5; assetClass = "💎 Franchise"; flags.push("⚡ Prime"); }
  
  // --- 4. MARKET GRAVITY (The Leafs Tax) ---
  if (MARKETS.TIER_S.includes(team)) {
      score += 4; // Standard Bonus
      // CULT HERO MODIFIER:
      // If Young + Tier S + Decent Production (>40 pace) -> Automatic Star Tier
      if (isYoung && wPts > 40) {
          score += 8; // Extra boost
          flags.push("🏟️ Cult Hero");
      }
  }

  if (draftYear == ROOKIE_DRAFT_YEAR) { score = Math.max(score, 75); flags.push("🔥 RC"); assetClass = "👶 Rookie"; }
  if (cups > 0) score += 3;

  score = (wPts > 50) ? 60 + ((wPts - 60)/2.2) : 60 - ((60 - wPts)/2);
  
  // Apply Bonuses
  score += bangerBonus;
  score += toiBonus;

  if (majorHW > 0) { score += (majorHW * 4); flags.push("🏆 LEGACY"); }

  // Golden Boy Override (Top 5 Draft)
  if (draft <= 5 && age <= 22) {
      score = Math.max(score, 88); flags.push("👑 Top 5"); assetClass = "💎 Blue Chip";
  }

  score = Math.min(99, Math.max(40, Math.round(score)));

  if (score >= 95) tier = "👑 GRAIL";
  else if (score >= 88) tier = "💎 FRANCHISE";
  else if (score >= 80) tier = "🔥 ELITE";
  else if (score >= 70) tier = "⭐ STAR";
  else tier = "📦 COMMON";

  return { score: score, tier: tier, assetClass: assetClass, flags: flags.join(" "), pace: Math.round(pacePts) };
}

// ==========================================  
// 🧠 ENGINE 2: MATH LOGIC (V22.4)
// ==========================================  
function calculateContextMath(gp, pts, ppp, pm, pos, cGP, cPts, cPPP, cPM, nhle, currentTOI, age) {
    if (gp < 5) return { signal: "—", delta: 0, currEV: 0, baseEV: 0 };

    var currEV = calculateEV(gp, pts, ppp);
    
    // --- BRANCH A: ESTABLISHED (GP > 82) ---
    if (cGP > 82) {
        var baseEV = calculateEV(cGP, cPts, cPPP);
        var delta = Math.round(currEV - baseEV);
        var signal = "—";

        if (baseEV > 80 && currentTOI < 15.5) {
             return { signal: "📉 DEMOTED", delta: delta, currEV: Math.round(currEV), baseEV: Math.round(baseEV) };
        }

        if (delta >= SELL_THRESHOLD) {
            if (age <= 23) signal = "🚀 BREAKOUT"; 
            else signal = "🔴 SELL";
        }
        else if (delta <= BUY_THRESHOLD) signal = "🟢 BUY";
        else if (delta > 5) signal = "Heating";

        return { signal: signal, delta: delta, currEV: Math.round(currEV), baseEV: Math.round(baseEV) };
    } 
    
    // --- BRANCH B: ROOKIES / PROSPECTS (<82 GP) ---
    else {
        var expEV = calculateEV(82, nhle, nhle * 0.2); 
        var delta = Math.round(currEV - expEV);
        var signal = "—";

        if (delta > 10) signal = "🔥 ROOKIE"; 
        else if (delta < -15) {
             if (gp < 40) signal = "⚠️ SLOW START"; 
             else signal = "⚠️ BUST?"; 
        }

        return { signal: signal, delta: delta, currEV: Math.round(currEV), baseEV: Math.round(expEV) + " (Exp)" };
    }
}

function calculateEV(gp, pts, ppp) {
    if (gp === 0) return 40;
    var evPts = pts - (ppp * 0.4); 
    var evRate = evPts / gp;
    var score = 40 + ((evRate / 1.4) * 60);
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
