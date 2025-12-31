/**
 * 🏒 MASTER SCOUT V21.0 - THE MONOLITH
 * ============================================
 * 1. 🧠 DUAL-CORE PROCESSOR: Runs the Full V15 Hobby Engine AND Full V19 Math Engine.
 * 2. ⚖️ THE VERDICT: Cross-references "Hobby Asset Class" with "Market Arbitrage Signal".
 * 3. 💾 DEEP CACHE: Stores full career history + pedigree + awards to prevent timeouts.
 */

// ==========================================
// ⚙️ CONFIGURATION (MERGED)
// ==========================================
const CURRENT_SEASON = "20252026"; 
const ROOKIE_DRAFT_YEAR = 2025;

const BUY_THRESHOLD = -10; // Math Signal: Buy if performing 10 pts BELOW career norm
const SELL_THRESHOLD = +14; // Math Signal: Sell if performing 14 pts ABOVE career norm

const NHLE_FACTORS = {
  "KHL": 0.76, "SHL": 0.55, "AHL": 0.45, "NCAA": 0.41, "NLA": 0.38, 
  "OHL": 0.30, "WHL": 0.30, "QMJHL": 0.28, "USHL": 0.25, "MHL": 0.20, "LIIGA": 0.38
};

const MARKETS = { 
  TIER_S: ["TOR", "MTL", "NYR", "CHI", "DET", "BOS"], 
  TIER_A: ["EDM", "VAN", "LAK", "PHI", "PIT", "BUF", "COL", "MIN", "NJD", "DAL"]
};

const TROPHY_CASE = { 
  GODS: ["Connor McDavid", "Connor Bedard", "Sidney Crosby", "Alex Ovechkin", "Cale Makar"],  
  DEFENSE_KINGS: ["Quinn Hughes", "Adam Fox", "Evan Bouchard", "Miro Heiskanen"],
  DEFENSE_CORE: ["Roman Josi", "Rasmus Dahlin", "Josh Morrissey", "Victor Hedman", "Noah Dobson", "Drew Doughty", "Erik Karlsson"]
};

// ========================================== 
// 🚀 MAIN EXECUTION
// ========================================== 
function onOpen() { 
  SpreadsheetApp.getUi().createMenu('🏒 Monolith V21') 
      .addItem('🚀 Run Full Analysis', 'runMonolithScout') 
      .addItem('🧹 Clear Cache', 'clearBioCache')
      .addToUi();
} 

function runMonolithScout() {  
  var ss = SpreadsheetApp.getActiveSpreadsheet();  
  var sheet = ss.getSheetByName("Monolith_Rankings");
  if (!sheet) { sheet = ss.insertSheet("Monolith_Rankings"); }  

  // --- HEADERS ---
  var HEADER = [  
    "PLAYER BIO", "", "", "", "", "", // Spacer
    "⚖️ THE VERDICT", "Action", "Confidence", // The Synthesis
    "🎨 HOBBY ENGINE", "Tier", "Asset Class", "Flags", "Hobby Score", // Script 1
    "🧮 MATH ENGINE", "Signal", "Δ Diff", "EV OFF", "Base EV", // Script 2
    "STATS", "Pace", "Headshot"
  ];
  
  sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]) 
       .setFontWeight("bold").setBackground("#000000").setFontColor("#00ff00"); // Matrix Style
  sheet.setFrozenRows(1);
  // Sub-headers
  sheet.getRange(2, 1, 1, 6).setValues([["Name", "Team", "Pos", "Age", "Draft", "GP"]]).setFontWeight("bold");

  var lastRow = sheet.getLastRow();
  if (lastRow > 2) sheet.getRange(3, 1, lastRow - 2, HEADER.length).clearContent();  

  // --- LOAD CACHE & DATA STREAMS ---
  var cacheData = loadCache(ss);
  var cacheUpdates = [];

  Logger.log("📡 Fetching Data Streams...");
  var sumData = fetchJson("https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=false&sort=%5B%7B%22property%22:%22points%22,%22direction%22:%22DESC%22%7D%5D&start=0&limit=-1&cayenneExp=gameTypeId=2%20and%20seasonId=" + CURRENT_SEASON).data || [];
  var rtMap = mapData(fetchJson("https://api.nhle.com/stats/rest/en/skater/realtime?isAggregate=false&isGame=false&start=0&limit=-1&cayenneExp=gameTypeId=2%20and%20seasonId=" + CURRENT_SEASON).data || []);
  var ppMap = mapData(fetchJson("https://api.nhle.com/stats/rest/en/skater/powerplay?isAggregate=false&isGame=false&start=0&limit=-1&cayenneExp=gameTypeId=2%20and%20seasonId=" + CURRENT_SEASON).data || []);

  var batchRows = [];
  var startTime = new Date().getTime();

  Logger.log("⚔️ Running Monolith Engines...");

  for (var k = 0; k < sumData.length; k++) {
    if (new Date().getTime() - startTime > 280000) { Logger.log("⏳ Time Limit"); break; }

    var s = sumData[k];
    if (s.positionCode === 'G') continue;
    if (s.gamesPlayed < 1 && s.points < 1) continue; 

    var pid = s.playerId;
    var rt = rtMap[pid] || {};
    var pp = ppMap[pid] || {};

    // --- 1. FULL BIO FETCH (Deep Scan) ---
    var bio;
    if (cacheData[pid]) {
        bio = cacheData[pid];
    } else {
        bio = fetchFullBio(pid); // Uses the V19 Deep Scan logic + V15 Pedigree logic
        cacheData[pid] = bio;
        cacheUpdates.push([pid, JSON.stringify(bio)]);
    }

    // --- 2. RUN ENGINE 1: HOBBY VALUATION (V15.2 Logic) ---
    var hobbyVal = calculateHobbyScoreV15(
        s.skaterFullName, s.teamAbbrevs, s.positionCode, bio.age, bio.pick, bio.year, 
        s.gamesPlayed, s.goals, s.assists, s.points, 
        bio.careerGP, bio.careerPts, bio.pedigreeStats, bio.awards
    );

    // --- 3. RUN ENGINE 2: ARBITRAGE MATH (V19.0 Logic) ---
    var mathVal = { signal: "—", delta: 0, currEV: 0, baseEV: 0 };
    
    // Only run math if they have a career baseline > 82 games
    if (bio.careerGP > 82) {
        var currMetrics = calculateMathMetrics(s.gamesPlayed, s.points, pp.ppPoints || 0, s.plusMinus, rt.blockedShots || 0, rt.takeaways || 0, rt.giveaways || 0, s.positionCode);
        var baseMetrics = calculateMathMetrics(bio.careerGP, bio.careerPts, bio.careerPPP, bio.careerPlusMinus, bio.careerBlks, bio.careerTake, bio.careerGive, s.positionCode);
        
        var delta = Math.round(currMetrics.EV_OFF - baseMetrics.EV_OFF);
        var signal = "—";
        if (delta >= SELL_THRESHOLD) signal = "🔴 SELL";
        else if (delta <= BUY_THRESHOLD) signal = "🟢 BUY";
        else if (delta > 5) signal = "Heating";
        else if (delta < -5) signal = "Cooling";

        mathVal = { signal: signal, delta: delta, currEV: Math.round(currMetrics.EV_OFF), baseEV: Math.round(baseMetrics.EV_OFF) };
    }

    // --- 4. THE SYNTHESIS (Verdict) ---
    var verdict = "Hold";
    var action = "—";
    var confidence = "Low";

    // A. The "Discounts"
    if (mathVal.signal === "🟢 BUY") {
        if (hobbyVal.tier === "🔥 ELITE" || hobbyVal.tier === "💎 FRANCHISE") { verdict = "🚨 ELITE DISCOUNT"; action = "💰 ALL IN"; confidence = "High"; }
        else if (hobbyVal.assetClass === "🏗️ Core Pillar") { verdict = "📈 VALUE PLAY"; action = "⚖️ ACCUMULATE"; confidence = "Med"; }
        else { verdict = "📉 DIP BUY"; action = "👀 WATCH"; confidence = "Low"; }
    }
    // B. The "Sell Highs"
    else if (mathVal.signal === "🔴 SELL") {
         if (hobbyVal.assetClass === "📈 Stock Up") { verdict = "🚀 HYPE TRAIN"; action = "🏃 SELL INTO HYPE"; confidence = "High"; }
         else if (hobbyVal.tier === "📦 COMMON") { verdict = "🔮 FAKE BREAKOUT"; action = "🗑️ DUMP"; confidence = "High"; }
         else { verdict = "💎 PEAK VALUE"; action = "⚖️ TRIM"; confidence = "Med"; }
    }
    // C. The "Steady"
    else {
         if (hobbyVal.tier === "🔥 ELITE") { verdict = "🔒 CORE ASSET"; action = "🛡️ HOLD"; confidence = "High"; }
         else if (hobbyVal.flags.includes("🚀 Breakout")) { verdict = "🚀 BREAKOUT"; action = "📈 BUY"; confidence = "Med"; }
         else { verdict = "✅ ROSTER"; action = "—"; }
    }

    batchRows.push([
      s.skaterFullName, s.teamAbbrevs, s.positionCode, bio.age, bio.year, s.gamesPlayed,
      verdict, action, confidence,
      "Hobby", hobbyVal.tier, hobbyVal.assetClass, hobbyVal.flags, hobbyVal.score, 
      "Math", mathVal.signal, mathVal.delta, mathVal.currEV, mathVal.baseEV, 
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
// 🧠 ENGINE 1: FULL HOBBY LOGIC (V15.2)
// ==========================================  
function calculateHobbyScoreV15(name, team, pos, age, draft, draftYear, gp, g, a, pts, careerGP, careerPts, pedigree, awards) {
  
  if (TROPHY_CASE.GODS.includes(name)) return { score: 99, tier: "👑 GRAIL", assetClass: "🐐 GOAT", flags: "IMMORTAL", pace: 100 };

  var score = 40; var assetClass = "Standard"; var flags = []; var tier = "Junk";

  // 1. Pace Calc
  var paceDivisor = Math.max(gp, 12); 
  var multiplier = 82 / paceDivisor;
  var paceG = g * multiplier; var paceA = a * multiplier; var pacePts = paceG + paceA;

  // 2. Sample Size Swap (Pedigree)
  if (age <= 23 && gp < 40 && pedigree.nhle > pacePts) {
      pacePts = pedigree.nhle; paceG = pacePts * 0.35; paceA = pacePts * 0.65;
      flags.push("🎓 Pedigree Floor");
  }

  // 3. Hardware
  var cups = 0; var major = 0; var minor = 0;
  awards.forEach(aw => {
     var n = aw.trophy.default;
     if (n.includes("Stanley")) cups++;
     else if (n.includes("Hart") || n.includes("Norris") || n.includes("Conn")) major++;
     else minor++;
  });
  var hwBonus = (cups * 3) + (major * 5) + (minor * 2);

  // 4. Weighted Points
  var wG = (pos==="D") ? 3.0 : 2.1; 
  var wA = (pos==="D") ? 0.9 : 1.0;
  var wPts = (paceG * wG) + (paceA * wA);

  // 5. Old Man Strength
  if (age > 34 && wPts < 60 && hwBonus < 5) { wPts = wPts * 0.85; assetClass = "⚰️ Retiring"; }
  // 6. Injury Tax
  if (gp < 30 && age > 22) { wPts = wPts * 0.90; flags.push("🩹 Injury Risk"); }

  // 7. Base Score
  score = (wPts > 50) ? 60 + ((wPts - 60)/3) : 60 - ((60 - wPts)/2);
  score += hwBonus;

  // 8. TRAJECTORY ENGINE (The complex part)
  var isYoung = (age <= 25);
  // Trajectory = Current Pace vs Career Avg
  var careerPPG = (careerGP > 40) ? (careerPts / careerGP) : 0.5;
  var traj = (pacePts/82) / careerPPG;

  // Ceiling Gate: Only apply breakout bonuses if NOT already elite
  if (isYoung && wPts < 80) {
      if (traj > 1.3 && wPts > 45) { score += 3; flags.push("🚀 Breakout"); assetClass = "📈 Stock Up"; }
      if (wPts > 60) { score += 3; assetClass = "🏗️ Core Pillar"; }
      else if (wPts > 45) { score += 1; assetClass = "🧩 Top 6 Key"; }
  }

  // 9. Bonuses
  if (paceA >= 65) { score += 3; flags.push("🍎 Playmaker"); }
  if (wPts > 95 && age <= 29) { score += 3; flags.push("⚡ Prime"); }
  if (MARKETS.TIER_S.includes(team)) score += 4;
  
  if (pos === "D") {
      if (TROPHY_CASE.DEFENSE_KINGS.includes(name)) score = Math.max(score, 92);
      if (TROPHY_CASE.DEFENSE_CORE.includes(name)) { score = Math.max(score, 88); flags.push("🛡️ Elite D"); }
  }

  // 10. Rookie Protection
  if (draftYear == ROOKIE_DRAFT_YEAR) { 
      if (score < 75) score = 75; 
      flags.push("🔥 RC Hype"); assetClass = "👶 Rookie Class"; 
  }

  // 11. Final Polish
  score = Math.min(98, Math.max(40, Math.round(score)));
  
  if (score >= 96) tier = "👑 GRAIL";
  else if (score >= 90) tier = "💎 FRANCHISE";
  else if (score >= 82) tier = "🔥 ELITE";
  else if (score >= 74) tier = "⭐ STAR";
  else if (score >= 60) tier = "✅ ROSTER";
  else tier = "📦 COMMON";

  return { score: score, tier: tier, assetClass: assetClass, flags: flags.join(" "), pace: Math.round(pacePts) };
}

// ==========================================  
// 🧠 ENGINE 2: FULL MATH LOGIC (V19.0)
// ==========================================  
function calculateMathMetrics(gp, pts, ppp, pm, blk, tk, gv, pos) {
    if (gp === 0) return { EV_OFF: 50 };

    var evPts = pts - ppp;
    var evRate = evPts / gp;
    
    // EV OFF (Log Curve)
    var evRatio = evRate / 0.80; // 0.8 EV PPG is Elite
    var evCurve = (evRatio <= 0) ? 0 : Math.sqrt(evRatio);
    var EV_OFF = 60 + (evCurve * 39);

    return { EV_OFF: Math.min(99, Math.max(36, EV_OFF)) };
}

// ==========================================  
// 💾 DEEP BIO SCANNER (MERGED)
// ==========================================  
function fetchFullBio(id) {
    try {
        var url = "https://api-web.nhle.com/v1/player/" + id + "/landing";
        var data = JSON.parse(UrlFetchApp.fetch(url, {'muteHttpExceptions': true}).getContentText());
        
        var birthDate = data.birthDate;  
        var age = birthDate ? Math.floor((new Date() - new Date(birthDate))/31557600000) : 27;
        var pick = data.draftDetails ? data.draftDetails.overallPick : 999;
        var year = data.draftDetails ? data.draftDetails.year : 0;

        // CAREER AGGREGATION
        var totals = { gp: 0, pts: 0, ppp: 0, pm: 0 };
        var seasons = data.seasonTotals || [];
        var maxNHLe = 0;

        for (var i = 0; i < seasons.length; i++) {
            var s = seasons[i];
            if (s.leagueAbbrev === "NHL") {
                totals.gp += (s.gamesPlayed || 0);
                totals.pts += (s.points || 0);
                totals.ppp += (s.powerPlayPoints || 0);
                totals.pm += (s.plusMinus || 0);
            } 
            // PEDIGREE CHECK
            else if (NHLE_FACTORS[s.leagueAbbrev] && s.gamesPlayed > 15) {
                var factor = NHLE_FACTORS[s.leagueAbbrev];
                var proj = (s.points / s.gamesPlayed) * factor * 82;
                if (proj > maxNHLe) maxNHLe = proj;
            }
        }
        
        // Infer hidden stats for baseline
        var baseBlk = totals.gp * 0.8; var baseTk = totals.gp * 0.4; var baseGv = totals.gp * 0.5;

        return {
            age: age, pick: pick, year: year,
            careerGP: totals.gp, careerPts: totals.pts, careerPPP: totals.ppp, careerPlusMinus: totals.pm,
            careerBlks: baseBlk, careerTake: baseTk, careerGive: baseGv,
            pedigreeStats: { nhle: maxNHLe }, awards: data.awards || []
        };
    } catch (e) {
        return { age: 25, careerGP: 0, pedigreeStats: {nhle:0}, awards: [] };
    }
}

// ==========================================  
// 🛠️ HELPERS
// ==========================================  
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
