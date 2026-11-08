/* ==========================================================================
   Northlight storefront — search.js
   The goods search page: builds the filter options from the catalogue, then
   filters and renders the results table. No dependencies.

   Sections:
     1. Catalogue
     2. Small helpers
     3. Filter controls (options, cascading selects, price range)
     4. Filtering + rendering
   ========================================================================== */

(function () {
  "use strict";

  /* ----------------------------- 1. Catalogue ----------------------------- */

  // The table lists the same 80 drops the home page shows, so every country
  // that has drops has rows here. assets/data/drops-data.js carries them (a
  // drop has title, creator, category, formats, license, refund, price); the
  // columns that only exist in the table are derived below.
  //
  // Row shape: [title, creator, category, format, price, rating, refund,
  //             collection, series]
  /* The drops, from whichever source has them:
       1. window.NL_DROPS  — assets/data/drops-data.js, loaded by the page;
       2. the same file fetched here — this covers an older search.html that
          never got the <script> tag (the usual cause of a half-empty table);
       3. nothing — the page says the catalogue did not load instead of
          pretending three rows are the whole shop. */
  function readDrops() {
    if (window.NL_DROPS && window.NL_DROPS.length) return window.NL_DROPS;

    // The page did not load the file (an older search.html), so read it here.
    // The array inside is strict JSON — this shop runs under a CSP without
    // 'unsafe-eval', so eval/Function are not an option.
    [
      "assets/data/drops-data.js",
      "assets/js/drops-data.js",
      "drops-data.js",
    ].some(function (path) {
      try {
        var request = new XMLHttpRequest();
        request.open("GET", path, false);
        request.send(null);
        if (request.status < 200 || request.status > 299) return false;

        var text = request.responseText;
        var from = text.indexOf("[", text.indexOf("NL_DROPS"));
        var to = text.lastIndexOf("]");
        if (from < 0 || to < from) return false;

        var drops = JSON.parse(text.slice(from, to + 1));
        if (drops && drops.length) {
          window.NL_DROPS = drops;
          return true;
        }
      } catch (error) {
        (window.console || {}).warn &&
          console.warn("[northlight] could not read " + path + ": " + error);
      }
      return false;
    });

    return window.NL_DROPS || [];
  }

  var DROPS = readDrops();

  if (!DROPS.length) {
    (window.console || {}).warn &&
      console.warn(
        "[northlight] the catalogue did not load. assets/data/drops-data.js is " +
          "missing or unreadable, so the search page has nothing to list."
      );
  }

  var RATINGS_BY_INDEX = ["Top rated", "High", "High", "New", "High"];

  var RAW = DROPS.map(function (drop, i) {
    var formats = String(drop.formats || "").split(",");
    return [
      drop.title,
      drop.creator,
      drop.category,
      String(formats[0] || "").trim(),
      drop.price,
      RATINGS_BY_INDEX[i % RATINGS_BY_INDEX.length],
      drop.refund,
      drop.category,
      drop.category,
    ];
  });

  // ISO 3166-1 alpha-2: [code, country]. Drives the Country select.
  var COUNTRIES = [
    ["AF", "Afghanistan"],     ["AX", "Åland Islands"],     ["AL", "Albania"],     ["DZ", "Algeria"],     ["AS", "American Samoa"],
    ["AD", "Andorra"],     ["AO", "Angola"],     ["AI", "Anguilla"],     ["AQ", "Antarctica"],     ["AG", "Antigua and Barbuda"],
    ["AR", "Argentina"],     ["AM", "Armenia"],     ["AW", "Aruba"],     ["AU", "Australia"],     ["AT", "Austria"],
    ["AZ", "Azerbaijan"],     ["BS", "Bahamas"],     ["BH", "Bahrain"],     ["BD", "Bangladesh"],     ["BB", "Barbados"],
    ["BY", "Belarus"],     ["BE", "Belgium"],     ["BZ", "Belize"],     ["BJ", "Benin"],     ["BM", "Bermuda"],
    ["BT", "Bhutan"],     ["BO", "Bolivia"],     ["BQ", "Bonaire, Sint Eustatius and Saba"],     ["BA", "Bosnia and Herzegovina"],     ["BW", "Botswana"],
    ["BV", "Bouvet Island"],     ["BR", "Brazil"],     ["IO", "British Indian Ocean Territory"],     ["BN", "Brunei"],     ["BG", "Bulgaria"],
    ["BF", "Burkina Faso"],     ["BI", "Burundi"],     ["CV", "Cabo Verde"],     ["KH", "Cambodia"],     ["CM", "Cameroon"],
    ["CA", "Canada"],     ["KY", "Cayman Islands"],     ["CF", "Central African Republic"],     ["TD", "Chad"],     ["CL", "Chile"],
    ["CN", "China"],     ["CX", "Christmas Island"],     ["CC", "Cocos (Keeling) Islands"],     ["CO", "Colombia"],     ["KM", "Comoros"],
    ["CG", "Congo"],     ["CD", "Congo (DRC)"],     ["CK", "Cook Islands"],     ["CR", "Costa Rica"],     ["CI", "Côte d'Ivoire"],
    ["HR", "Croatia"],     ["CU", "Cuba"],     ["CW", "Curaçao"],     ["CY", "Cyprus"],     ["CZ", "Czechia"],
    ["DK", "Denmark"],     ["DJ", "Djibouti"],     ["DM", "Dominica"],     ["DO", "Dominican Republic"],     ["EC", "Ecuador"],
    ["EG", "Egypt"],     ["SV", "El Salvador"],     ["GQ", "Equatorial Guinea"],     ["ER", "Eritrea"],     ["EE", "Estonia"],
    ["SZ", "Eswatini"],     ["ET", "Ethiopia"],     ["FK", "Falkland Islands"],     ["FO", "Faroe Islands"],     ["FJ", "Fiji"],
    ["FI", "Finland"],     ["FR", "France"],     ["GF", "French Guiana"],     ["PF", "French Polynesia"],     ["TF", "French Southern Territories"],
    ["GA", "Gabon"],     ["GM", "Gambia"],     ["GE", "Georgia"],     ["DE", "Germany"],     ["GH", "Ghana"],
    ["GI", "Gibraltar"],     ["GR", "Greece"],     ["GL", "Greenland"],     ["GD", "Grenada"],     ["GP", "Guadeloupe"],
    ["GU", "Guam"],     ["GT", "Guatemala"],     ["GG", "Guernsey"],     ["GN", "Guinea"],     ["GW", "Guinea-Bissau"],
    ["GY", "Guyana"],     ["HT", "Haiti"],     ["HM", "Heard Island and McDonald Islands"],     ["VA", "Holy See"],     ["HN", "Honduras"],
    ["HK", "Hong Kong"],     ["HU", "Hungary"],     ["IS", "Iceland"],     ["IN", "India"],     ["ID", "Indonesia"],
    ["IR", "Iran"],     ["IQ", "Iraq"],     ["IE", "Ireland"],     ["IM", "Isle of Man"],     ["IL", "Israel"],
    ["IT", "Italy"],     ["JM", "Jamaica"],     ["JP", "Japan"],     ["JE", "Jersey"],     ["JO", "Jordan"],
    ["KZ", "Kazakhstan"],     ["KE", "Kenya"],     ["KI", "Kiribati"],     ["KP", "North Korea"],     ["KR", "South Korea"],
    ["KW", "Kuwait"],     ["KG", "Kyrgyzstan"],     ["LA", "Laos"],     ["LV", "Latvia"],     ["LB", "Lebanon"],
    ["LS", "Lesotho"],     ["LR", "Liberia"],     ["LY", "Libya"],     ["LI", "Liechtenstein"],     ["LT", "Lithuania"],
    ["LU", "Luxembourg"],     ["MO", "Macao"],     ["MG", "Madagascar"],     ["MW", "Malawi"],     ["MY", "Malaysia"],
    ["MV", "Maldives"],     ["ML", "Mali"],     ["MT", "Malta"],     ["MH", "Marshall Islands"],     ["MQ", "Martinique"],
    ["MR", "Mauritania"],     ["MU", "Mauritius"],     ["YT", "Mayotte"],     ["MX", "Mexico"],     ["FM", "Micronesia"],
    ["MD", "Moldova"],     ["MC", "Monaco"],     ["MN", "Mongolia"],     ["ME", "Montenegro"],     ["MS", "Montserrat"],
    ["MA", "Morocco"],     ["MZ", "Mozambique"],     ["MM", "Myanmar"],     ["NA", "Namibia"],     ["NR", "Nauru"],
    ["NP", "Nepal"],     ["NL", "Netherlands"],     ["NC", "New Caledonia"],     ["NZ", "New Zealand"],     ["NI", "Nicaragua"],
    ["NE", "Niger"],     ["NG", "Nigeria"],     ["NU", "Niue"],     ["NF", "Norfolk Island"],     ["MK", "North Macedonia"],
    ["MP", "Northern Mariana Islands"],     ["NO", "Norway"],     ["OM", "Oman"],     ["PK", "Pakistan"],     ["PW", "Palau"],
    ["PS", "Palestine"],     ["PA", "Panama"],     ["PG", "Papua New Guinea"],     ["PY", "Paraguay"],     ["PE", "Peru"],
    ["PH", "Philippines"],     ["PN", "Pitcairn"],     ["PL", "Poland"],     ["PT", "Portugal"],     ["PR", "Puerto Rico"],
    ["QA", "Qatar"],     ["RE", "Réunion"],     ["RO", "Romania"],     ["RU", "Russia"],     ["RW", "Rwanda"],
    ["BL", "Saint Barthélemy"],     ["SH", "Saint Helena"],     ["KN", "Saint Kitts and Nevis"],     ["LC", "Saint Lucia"],     ["MF", "Saint Martin"],
    ["PM", "Saint Pierre and Miquelon"],     ["VC", "Saint Vincent and the Grenadines"],     ["WS", "Samoa"],     ["SM", "San Marino"],     ["ST", "Sao Tome and Principe"],
    ["SA", "Saudi Arabia"],     ["SN", "Senegal"],     ["RS", "Serbia"],     ["SC", "Seychelles"],     ["SL", "Sierra Leone"],
    ["SG", "Singapore"],     ["SX", "Sint Maarten"],     ["SK", "Slovakia"],     ["SI", "Slovenia"],     ["SB", "Solomon Islands"],
    ["SO", "Somalia"],     ["ZA", "South Africa"],     ["GS", "South Georgia and the South Sandwich Islands"],     ["SS", "South Sudan"],     ["ES", "Spain"],
    ["LK", "Sri Lanka"],     ["SD", "Sudan"],     ["SR", "Suriname"],     ["SJ", "Svalbard and Jan Mayen"],     ["SE", "Sweden"],
    ["CH", "Switzerland"],     ["SY", "Syria"],     ["TW", "Taiwan"],     ["TJ", "Tajikistan"],     ["TZ", "Tanzania"],
    ["TH", "Thailand"],     ["TL", "Timor-Leste"],     ["TG", "Togo"],     ["TK", "Tokelau"],     ["TO", "Tonga"],
    ["TT", "Trinidad and Tobago"],     ["TN", "Tunisia"],     ["TR", "Türkiye"],     ["TM", "Turkmenistan"],     ["TC", "Turks and Caicos Islands"],
    ["TV", "Tuvalu"],     ["UG", "Uganda"],     ["UA", "Ukraine"],     ["AE", "United Arab Emirates"],     ["GB", "United Kingdom"],
    ["US", "United States"],     ["UM", "United States Minor Outlying Islands"],     ["UY", "Uruguay"],     ["UZ", "Uzbekistan"],     ["VU", "Vanuatu"],
    ["VE", "Venezuela"],     ["VN", "Viet Nam"],     ["VG", "Virgin Islands (British)"],     ["VI", "Virgin Islands (US)"],     ["WF", "Wallis and Futuna"],
    ["EH", "Western Sahara"],     ["YE", "Yemen"],     ["ZM", "Zambia"],     ["ZW", "Zimbabwe"]
  ];

  // Each studio lists from one country, so goods inherit their creator's country.
  // Each studio also sits in one state / province, so the State filter has
  // something real to filter on. Names match states-data.js exactly.
  var CREATOR_STATE = {
    "studio-north": "California",
    "inkwell": "London",
    "typeworks": "North Holland",
    "paper-co": "Greater Accra",
    "lo-fi-lab": "Lagos",
    "atlas-maps": "Al Asimah",
    "northlight": "New York",
    "monoprint": "Berlin",
    "verdant": "Nairobi City",
    "quiethours": "Capital",
    "halftone": "Tokyo",
    "pixel-lab": "Seoul",
    "northfield": "Ontario",
    "southern-cross": "New South Wales",
    "reef-lab": "Queensland",
    "tropic-type": "São Paulo",
    "viva-lab": "Rio de Janeiro",
    "indigo-ink": "Maharashtra",
    "lumen-works": "Karnataka",
    "kalahari-kit": "Gauteng",
    "cape-code": "Western Cape",
    "dune-works": "Dubai",
    "gulf-grid": "Abu Dhabi",
    "tinta-viva": "Madrid",
    "sol-y-mar": "Barcelona",
  };

  var CREATOR_COUNTRY = {
    "studio-north": "US",
    "inkwell": "GB",
    "typeworks": "NL",
    "paper-co": "GH",
    "lo-fi-lab": "NG",
    "atlas-maps": "KW",
    "northlight": "US",
    "monoprint": "DE",
    "verdant": "KE",
    "quiethours": "IS",
    "halftone": "JP",
    "pixel-lab": "KR",
    "northfield": "CA",
    "southern-cross": "AU",
    "reef-lab": "AU",
    "tropic-type": "BR",
    "viva-lab": "BR",
    "indigo-ink": "IN",
    "lumen-works": "IN",
    "kalahari-kit": "ZA",
    "cape-code": "ZA",
    "dune-works": "AE",
    "gulf-grid": "AE",
    "tinta-viva": "ES",
    "sol-y-mar": "ES",
  };

  // National postal formats: # = digit, A = uppercase letter, the rest literal.
  var ZIP_PATTERN = {
    "US": "#####", "CA": "A#A #A#", "MX": "#####", "BR": "#####-###", "AR": "A####AAA", "CL": "#######",
    "CO": "######", "PE": "#####", "EC": "######", "VE": "####", "UY": "#####", "PY": "####",
    "BO": "####", "CR": "#####", "PA": "####", "GT": "#####", "DO": "#####", "JM": "##",
    "TT": "######", "GB": "AA# #AA", "IE": "A## A###", "FR": "#####", "DE": "#####", "IT": "#####",
    "ES": "#####", "PT": "####-###", "NL": "#### AA", "BE": "####", "LU": "####", "CH": "####",
    "AT": "####", "DK": "####", "NO": "####", "SE": "### ##", "FI": "#####", "IS": "###",
    "PL": "##-###", "CZ": "### ##", "SK": "### ##", "HU": "####", "RO": "######", "BG": "####",
    "GR": "### ##", "HR": "#####", "SI": "####", "RS": "#####", "BA": "#####", "ME": "#####",
    "MK": "####", "AL": "####", "EE": "#####", "LV": "LV-####", "LT": "LT-#####", "BY": "######",
    "UA": "#####", "RU": "######", "MD": "MD-####", "TR": "#####", "CY": "####", "MT": "AAA ####",
    "GE": "####", "AM": "####", "AZ": "AZ ####", "KZ": "######", "UZ": "######", "KG": "######",
    "TJ": "######", "TM": "######", "MN": "######", "CN": "######", "JP": "###-####", "KR": "#####",
    "TW": "###", "SG": "######", "MY": "#####", "TH": "#####", "VN": "######", "ID": "#####",
    "PH": "####", "IN": "######", "PK": "#####", "BD": "####", "LK": "#####", "NP": "#####",
    "BT": "#####", "MV": "#####", "MM": "#####", "KH": "#####", "LA": "#####", "BN": "AA####",
    "AU": "####", "NZ": "####", "ZA": "####", "NG": "######", "GH": "AA-###-####", "KE": "#####",
    "TZ": "#####", "UG": "#####", "ET": "####", "EG": "#####", "MA": "#####", "DZ": "#####",
    "TN": "####", "LY": "#####", "SD": "#####", "SN": "#####", "CI": "#####", "CM": "#####",
    "ZW": "####", "ZM": "#####", "BW": "#####", "NA": "#####", "MZ": "####", "AO": "#####",
    "MW": "#####", "RW": "####", "BI": "####", "MU": "#####", "MG": "###", "SA": "#####",
    "AE": "#####", "QA": "#####", "KW": "#####", "BH": "###", "OM": "###", "JO": "#####",
    "LB": "#### ####", "SY": "#####", "IQ": "#####", "IR": "##########", "IL": "#######", "PS": "###",
    "YE": "#####", "AF": "####", "HK": "######", "MO": "######"
  };

  // Codes shown first for the countries that actually list goods.
  var ZIP_CURATED = {
    US: ["10001", "10002", "11201", "33139", "60601", "90001"],
    GB: ["E1 6QL", "EC1V 9BD", "M1 1AE", "SW1A 1AA", "B1 1BB"],
    NG: ["101241", "100001", "500001", "900001", "400001"],
    GH: ["GA-001-0000", "AK-039-5028", "GA-183-4241"],
    KW: ["13001", "13002", "22001", "30001"],
    NL: ["1011 AC", "1012 AB", "3011 AB", "5611 AB"],
    DE: ["10115", "10117", "80331", "20095"],
    KE: ["00100", "00200", "30100"],
    IS: ["101", "105", "220"],
    JP: ["100-0001", "150-0001", "530-0001"],
    KR: ["03051", "03154", "48058"],
    CA: ["K1A 0B1", "M5V 2T6", "V6B 1A1"],
    FR: ["75001", "13001", "69001"],
    CN: ["100000", "200000", "518000"],
    IN: ["110001", "400001", "560001"],
    AU: ["2000", "3000", "4000"],
    ZA: ["0001", "8001", "4001"],
    BR: ["01000-000", "20000-000", "01310-100"],
    SG: ["018956", "238823", "408600"],
    AE: ["00000", "00001"]
  };

  // The postal code of the studio behind each listing.
  var STUDIO_ZIP = {
    "studio-north": "10001",
    "inkwell": "E1 6QL",
    "typeworks": "1011 AC",
    "paper-co": "GA-001-0000",
    "lo-fi-lab": "101241",
    "atlas-maps": "13001",
    "northlight": "90001",
    "monoprint": "10115",
    "verdant": "00100",
    "quiethours": "101",
    "halftone": "100-0001",
    "pixel-lab": "03051",
    "northfield": "K1A 0B1",
    "southern-cross": "2000",
    "reef-lab": "4000",
    "tropic-type": "01000-000",
    "viva-lab": "22000-000",
    "indigo-ink": "400001",
    "lumen-works": "560001",
    "kalahari-kit": "2001",
    "cape-code": "8001",
    "dune-works": "00000",
    "gulf-grid": "00000",
    "tinta-viva": "28001",
    "sol-y-mar": "08001",
  };

  var ZIP_LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ";

  // Deterministic sample codes in the country's own postal format, so every
  // country has something in the ZIP field. Demo data, not a postal database.
  function generatedZips(code, count) {
    var pattern = ZIP_PATTERN[code] || "#####";
    var seed = 0;
    for (var i = 0; i < code.length; i += 1) {
      seed = (seed * 131 + code.charCodeAt(i) * (i + 7)) % 100003;
    }

    var out = [];
    for (var n = 0; n < count; n += 1) {
      var value = seed + n * 7919 + 1;
      var made = "";
      for (var p = 0; p < pattern.length; p += 1) {
        value = (value * 1103515245 + 12345) % 2147483648;
        var ch = pattern.charAt(p);
        if (ch === "#") made += String(value % 10);
        else if (ch === "A") made += ZIP_LETTERS.charAt(value % ZIP_LETTERS.length);
        else made += ch;
      }
      if (out.indexOf(made) === -1) out.push(made);
    }
    return out;
  }

  // Codes embedded in zips-data.js win; anything missing there falls back to
  // the generated samples below, so a partial data file still works.
  // When the dataset is big, zips-data.js only carries totals and each
  // country's codes are fetched on demand from  <NL_ZIPS_SPLIT><CC>.json
  var SPLIT_DIR = (typeof window !== "undefined" && window.NL_ZIPS_SPLIT) || "";
  var SPLIT_TOTALS = (typeof window !== "undefined" && window.NL_ZIP_TOTALS) || {};
  var zipLoading = {};

  var EMBEDDED_ZIPS = (typeof window !== "undefined" && window.NL_ZIPS) || null;
  var EMBEDDED_PLACES = (typeof window !== "undefined" && window.NL_ZIP_PLACES) || null;
  // codes confirmed against Geoapify (see fetch-postcodes.py / /api/postcode)
  var VERIFIED_ZIPS = (typeof window !== "undefined" && window.NL_ZIP_VERIFIED) || {};
  var verifiedAt = {};
  Object.keys(VERIFIED_ZIPS).forEach(function (country) {
    verifiedAt[country] = {};
    VERIFIED_ZIPS[country].forEach(function (code) {
      verifiedAt[country][code] = true;
    });
  });
  var ZIP_OPTION_LIMIT = 400;

  function fallbackZips(code) {
    var list = ZIP_CURATED[code] ? ZIP_CURATED[code].slice() : [];
    generatedZips(code, 14).forEach(function (zip) {
      if (list.indexOf(zip) === -1) list.push(zip);
    });
    return list;
  }

  // country code -> the codes its ZIP select offers
  var ZIPS = {};
  var ZIP_TOTALS = {};
  (function buildZips() {
    var studioZips = {};
    Object.keys(STUDIO_ZIP).forEach(function (creator) {
      var code = CREATOR_COUNTRY[creator] || "US";
      studioZips[code] = studioZips[code] || [];
      if (studioZips[code].indexOf(STUDIO_ZIP[creator]) === -1) {
        studioZips[code].push(STUDIO_ZIP[creator]);
      }
    });

    COUNTRIES.forEach(function (pair) {
      var code = pair[0];

      // split builds carry the codes in <CC>.json — nothing is prefilled here,
      // so refreshZips() knows to fetch
      if (SPLIT_DIR) {
        ZIP_TOTALS[code] = SPLIT_TOTALS[code] || 0;
        return;
      }

      var list = [];

      function add(zip) {
        if (list.indexOf(zip) === -1) list.push(zip);
      }

      (studioZips[code] || []).forEach(add);

      var embedded = EMBEDDED_ZIPS && EMBEDDED_ZIPS[code];
      if (embedded && embedded.length) {
        embedded.forEach(add);
        ZIP_TOTALS[code] = list.length;
        ZIPS[code] = list.slice(0, ZIP_OPTION_LIMIT);
        return;
      }

      (ZIP_CURATED[code] || []).forEach(add);
      generatedZips(code, 14).forEach(add);
      ZIP_TOTALS[code] = list.length;
      ZIPS[code] = list.slice(0, 14);
    });

  })();

  function countryName(code) {
    for (var i = 0; i < COUNTRIES.length; i += 1) {
      if (COUNTRIES[i][0] === code) return COUNTRIES[i][1];
    }
    return code;
  }

  // "Nov 26" -> 2026 * 12 + 10, so months can be compared as numbers
  function refreshKey(item) {
    var parts = String(item.updated || "").split(" ");
    var month = MONTHS.indexOf(parts[0]);
    var year = parseInt(parts[1], 10);
    if (month < 0 || isNaN(year)) return 0;
    return (2000 + year) * 12 + month;
  }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /* ============================ EDIT ME =================================
     The words that appear in the listing table's criteria columns.

     PLANS          -> the "Level" column. Add, remove or rename freely: the
                       list is spread across the catalogue by position, so a
                       4th entry simply joins the rotation.
     RATINGS        -> the "Base Quality" column (there is no Rating filter).
     REFUNDS        -> the "Refresh"/refund wording, and the Refund filter.
     "COMMERCIAL" / "PERSONAL" (in row(), under Licence) is the only pair that
                       is decided per item, by features.commercial.
     ====================================================================== */
  var PLANS = ["CLASSIC", "SHOP & SPLIT", "COMMERCIAL", "DEFERRED DEBIT", "PREPAID MEAL", "EXECUTIVE BUSSINESS", "PURCHASING WITH FLEET", "PREPAID GOLD PAYROLL", "WORLD FOR BUSSINESS", "PERSONAL", "ENHANCED"];
  var RATINGS = ["Top rated", "VeryHigh"];
  var REFUNDS = ["7 days", "14 days", "30 days", "Not eligible"];

  // The storefront a creator sells through, shown in the Seller column.
  var SHOPS = {
    "studio-north": "Studio North Co.",
    "inkwell": "Inkwell Press",
    "typeworks": "Typeworks Foundry",
    "paper-co": "Paper & Co.",
    "lo-fi-lab": "Lo-Fi Lab Audio",
    "atlas-maps": "Atlas Map Room",
    "northlight": "Northlight Supply",
    "monoprint": "Monoprint Atelier",
    "verdant": "Verdant Assets",
    "quiethours": "Quiet Hours",
    "halftone": "Halftone Studio",
    "pixel-lab": "Pixel Lab",
    "northfield": "Northfield Type",
    "southern-cross": "Southern Cross Studio",
    "reef-lab": "Reef Lab",
    "tropic-type": "Tropic Type",
    "viva-lab": "Viva Lab",
    "indigo-ink": "Indigo Ink",
    "lumen-works": "Lumen Works",
    "kalahari-kit": "Kalahari Kit",
    "cape-code": "Cape Code",
    "dune-works": "Dune Works",
    "gulf-grid": "Gulf Grid",
    "tinta-viva": "Tinta Viva",
    "sol-y-mar": "Sol y Mar",
  };

  // How long a buyer keeps updates and support for a listing.
  var SUPPORT_BY_PLAN = {
    CLASSIC: "CREDIT",
    "SHOP & SPLIT": "DEBIT",
    COMMERCIAL: "DEBIT",
    "DEFERRED DEBIT": "DEBIT",
    "PREPAID MEAL": "DEBIT",
    "EXECUTIVE BUSINESS": "DEBIT",
    "PURCHASING WITH FLEET": "DEBIT",
    "PREPAID GOLD PAYROLL": "DEBIT",
    "WORLD FOR BUSINESS": "DEBIT",
    PERSONAL: "CREDIT",
    ENHANCED: "CREDIT"
  };

  // The Level and Refresh filters carry two choices each.
  var LEVEL_FILTER = ["Classic", "Shop & Split", "Commercial", "Deferred Debit", "Prepaid Meal", "Executive Bussiness", "Purchasing with Fleet", "Prepaid Gold Payroll", "World for Bussiness", "Personal", "Enhanced"];
  var REFRESH_FILTER = ["This year", "Next Year", "Not eligible"];

  // Everything the filters need is derived here, so the table markup stays thin.
  var STATE_NAMES = (window.NL_STATES || {});
  // city lists, country -> state -> cities (12 catalogue countries)
  var CITY_NAMES = (window.NL_CITIES || {});
  // banks per country, used by the Bank filter
  var BANK_NAMES = (window.NL_BANKS || {});

  // The bank that settles a listing's orders (and pays its refunds), taken from
  // its country's list and spread by catalogue position.
  function itemBank(index, code) {
    var names = BANK_NAMES[code] || [];
    if (!names.length) return "";
    return names[(index * 5 + 3) % names.length] || names[0];
  }

  // A studio has one home state, but its listings are spread over the other
  // states of its country too (deterministically, by catalogue position) so
  // the State filter really narrows the table instead of echoing the creator.
  function itemState(index, creator) {
    var names = STATE_NAMES[CREATOR_COUNTRY[creator] || "US"] || [];
    var home = CREATOR_STATE[creator] || "";

    if (!names.length) return home;
    if (index % 5 < 3) return home; // three in five stay in the studio's state
    return names[(index * 7) % names.length] || home;
  }

  // The city a listing sits in: the state's own list decides, and the index of
  // the listing spreads it across those cities so the City filter narrows too.
  function itemCity(index, state) {
    var code = arguments.length > 2 ? arguments[2] : "";
    var byState = CITY_NAMES[code] || {};
    var names = byState[state] || [];
    if (!names.length) return "";
    return names[(index * 3) % names.length] || names[0];
  }

  // Which states actually hold listings, per country — the ZIP assignment below
  // only has to cover these.
  var STATES_WITH_ITEMS = {};
  RAW.forEach(function (row, i) {
    var code = CREATOR_COUNTRY[row[1]] || "US";
    var state = itemState(i, row[1]);
    STATES_WITH_ITEMS[code] = STATES_WITH_ITEMS[code] || [];
    if (STATES_WITH_ITEMS[code].indexOf(state) === -1) STATES_WITH_ITEMS[code].push(state);
  });
  Object.keys(STATES_WITH_ITEMS).forEach(function (code) {
    STATES_WITH_ITEMS[code].sort();
  });

  // One postal code per occupied state, taken from that country's own list, so
  // a ZIP always belongs to exactly one state and the ZIP select can narrow to
  // the state that is picked.
  function zipForState(code, state) {
    var pool = ZIPS[code] && ZIPS[code].length ? ZIPS[code] : fallbackZips(code);
    var states = STATES_WITH_ITEMS[code] || [];
    var index = states.indexOf(state);
    if (!pool.length) return "";
    return pool[(index < 0 ? 0 : index) % pool.length];
  }

  // ---- Catalogue ids ------------------------------------------------------
  // Six digits with a mix of leading blocks (4, 51, 34, 60), so the column does
  // not read as one long run. Computed from the position, never at random at
  // run time: an id never changes between loads, and server/app.py runs the
  // same routine (catalogue_ids) so Buy always matches the row it was clicked on.
  var ID_PREFIXES = ["4", "51", "34", "60"];

  function goodsIds(count) {
    var ids = [];
    var seen = {};
    for (var i = 0; i < count; i++) {
      var prefix = ID_PREFIXES[i % ID_PREFIXES.length];
      var width = 6 - prefix.length;
      var space = Math.pow(10, width);
      var h = ((i + 1) * 2654435761) % 2147483647;
      var id;
      do {
        h = (h * 48271) % 2147483647;
        var body = String(h % space);
        while (body.length < width) body = "0" + body;
        id = prefix + body;
      } while (seen[id]);
      seen[id] = true;
      ids.push(id);
    }
    return ids;
  }

  /* Every tick in the Checks and Special Info columns can be set per drop.
     Add "verified": { "email": true, ... } or a plain boolean such as
     "discount": true to an entry in assets/data/drops-data.js and that drop
     follows it; leave the field out and the default pattern below applies. */
  function dropFlag(i, key, fallback) {
    var drop = DROPS[i];
    return drop && typeof drop[key] === "boolean" ? drop[key] : fallback;
  }

  function dropVerified(i, key, fallback) {
    var drop = DROPS[i];
    var set = drop && drop.verified;
    return set && typeof set[key] === "boolean" ? set[key] : fallback;
  }

  var GOODS_IDS = goodsIds(RAW.length);

  var GOODS = RAW.map(function (row, i) {
    var d = new Date();
    d.setDate(d.getDate() - ((i * 5) % 210)); // spread "updated" over ~7 months

    var home = CREATOR_COUNTRY[row[1]] || "US";
    var state = itemState(i, row[1]);

    return {
      title: row[0],
      creator: row[1],
      category: row[2],
      country: home,
      zip: zipForState(home, state) || STUDIO_ZIP[row[1]] || "",
      countryName: countryName(home),
      state: state,
      city: itemCity(i, state, home),
      bank: itemBank(i, home),
      format: row[3],
      price: row[4],
      rating: row[5],
      refund: row[6],
      collection: row[7],
      series: row[8],
      id: GOODS_IDS[i],
      plan: PLANS[i % 3],
      premium: i % 3 !== 1,
      discount: dropFlag(i, "discount", true),
      updated: MONTHS[d.getMonth()] + " " + String(d.getFullYear()).slice(2),
      recent: dropFlag(i, "recent", false),
      refundable: false,
      // what the seller has verified about itself; the Checks column reads this
      verified: {
        email: dropVerified(i, "email", true),
        phone: dropVerified(i, "phone", true),
        id: dropVerified(i, "DOB", false),
        address: dropVerified(i, "SSN", false),
      },
      features: {
        source: i % 3 !== 2,
        docs: i % 2 === 0,
        samples: i % 4 !== 3,
        commercial: i % 5 !== 4,
        beginner: dropFlag(i, "beginner", false),
        autolayout: i % 4 !== 1,
        tokens: i % 5 !== 2,
        dark: i % 2 === 1,
      },
      tags: [
        row[2].toLowerCase(),
        row[1],
        (CREATOR_COUNTRY[row[1]] || "US").toLowerCase(),
        countryName(CREATOR_COUNTRY[row[1]] || "US").toLowerCase(),
      ],
    };
  });

  /* ----------------------------- 2. Helpers ------------------------------- */

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function unique(list) {
    return list.filter(function (value, index) {
      return list.indexOf(value) === index;
    });
  }

  // values may be plain strings or [value, label] pairs (the country list).
  function fillSelect(select, values, allLabel) {
    select.innerHTML = "";
    var all = document.createElement("option");
    all.value = "";
    all.textContent = allLabel || "All";
    select.appendChild(all);

    values.forEach(function (value) {
      var option = document.createElement("option");
      var pair = Array.isArray(value);
      option.value = pair ? value[0] : value;
      option.textContent = pair ? value[0] + " — " + value[1] : value;
      select.appendChild(option);
    });
  }

  /* --------------------------- 3. Filter controls -------------------------- */

  var ui = {
    country: $("#fCountry"),
    combo: $("#countryCombo"),
    comboInput: $("#fCountryInput"),
    comboList: $("#countryList"),
    comboToggle: $("#countryCombo .combo__toggle"),
    comboHint: $("#countryHint"),
    zip: $("#fZip"),
    zipHint: $("#zipHint"),
    zipCheck: $("#zipCheck"),
    zipCheckText: $("#zipCheckText"),
    zipCheckBtn: $("#zipCheckBtn"),
    tags: $("#fTags"),
    bank: $("#fBank"),
    id: $("#fId"),
    refund: $("#fRefund"),
    level: $("#fLevel"),
    refresh: $("#fRefresh"),
    creator: $("#fCreator"),
    state: $("#fState"),
    city: $("#fCity"),
    priceMin: $("#priceMin"),
    priceMax: $("#priceMax"),
    priceMinNum: $("#priceMinNum"),
    priceMaxNum: $("#priceMaxNum"),
    rangeFill: $("#rangeFill"),
    rangeHint: $("#rangeHint"),
    pageSize: $("#pageSize"),
    body: $("#rtableBody"),
    table: $("#rtable"),
    empty: $("#resultsEmpty"),
    note: $("#buyNote"),
    form: $("#filters"),
  };

  /* --- country combobox: type an abbreviation (NG), a name (Nigeria) or pick
     a row from the list ---------------------------------------------------- */
  var COUNTRIES_BY_NAME = COUNTRIES.slice().sort(function (a, b) {
    return a[1].localeCompare(b[1]);
  });

  var combo = { active: 0, moved: false, rows: [] };

  function comboMatches(text) {
    var q = String(text || "").trim().toLowerCase();
    if (!q) return COUNTRIES_BY_NAME;

    var scored = [];
    COUNTRIES_BY_NAME.forEach(function (pair) {
      var code = pair[0].toLowerCase();
      var name = pair[1].toLowerCase();
      var score = -1;

      if (code === q) score = 0;
      else if (name === q) score = 1;
      else if (code.indexOf(q) === 0) score = 2;
      else if (name.indexOf(q) === 0) score = 3;
      else if (name.indexOf(q) > -1) score = 4;

      if (score > -1) scored.push([score, pair]);
    });

    scored.sort(function (a, b) {
      return a[0] - b[0] || a[1][1].localeCompare(b[1][1]);
    });

    return scored.map(function (entry) { return entry[1]; });
  }

  // "NG" -> ["NG", "Nigeria"]; anything that is not a country -> null
  function resolveCountry(text) {
    var q = String(text || "").trim().toLowerCase();
    if (!q) return null;
    var found = null;
    COUNTRIES.forEach(function (pair) {
      if (found) return;
      if (pair[0].toLowerCase() === q) found = pair;
    });
    if (found) return found;
    COUNTRIES.forEach(function (pair) {
      if (found) return;
      if (pair[1].toLowerCase() === q) found = pair;
    });
    return found;
  }

  function countryLabel(code) {
    if (!code) return "";
    return code + " — " + countryName(code);
  }

  function closeCombo() {
    ui.comboList.hidden = true;
    ui.combo.classList.remove("is-open");
    ui.comboInput.setAttribute("aria-expanded", "false");
    ui.comboInput.removeAttribute("aria-activedescendant");
    combo.active = -1;
  }

  function highlightCombo(index) {
    var items = ui.comboList.querySelectorAll(".combo__option");
    if (!items.length) return;
    combo.active = Math.max(0, Math.min(items.length - 1, index));
    Array.prototype.forEach.call(items, function (item, i) {
      item.classList.toggle("is-active", i === combo.active);
      item.setAttribute("aria-selected", i === combo.active ? "true" : "false");
    });
    var current = items[combo.active];
    ui.comboInput.setAttribute("aria-activedescendant", current.id);
    if (current.scrollIntoView) current.scrollIntoView({ block: "nearest" });
  }

  function openCombo() {
    var current = countryLabel(ui.country.value);
    var typed = ui.comboInput.value === current ? "" : ui.comboInput.value;
    var results = comboMatches(typed);
    combo.moved = false;
    ui.comboList.innerHTML = "";

    var all = document.createElement("li");
    all.className = "combo__option";
    all.id = "country-option-all";
    all.setAttribute("role", "option");
    all.dataset.code = "";
    all.innerHTML = '<span class="combo__code">All</span><span>All countries</span>';
    ui.comboList.appendChild(all);

    results.forEach(function (pair) {
      var li = document.createElement("li");
      li.className = "combo__option" + (pair[0] === ui.country.value ? " is-selected" : "");
      li.id = "country-option-" + pair[0];
      li.setAttribute("role", "option");
      li.dataset.code = pair[0];
      li.innerHTML =
        '<span class="combo__code">' + pair[0] + "</span><span>" + pair[1] + "</span>";
      ui.comboList.appendChild(li);
    });

    if (!results.length) {
      var empty = document.createElement("li");
      empty.className = "combo__empty";
      empty.textContent = "No country matches “" + typed.trim() + "”.";
      ui.comboList.appendChild(empty);
    }

    ui.comboList.hidden = false;
    ui.combo.classList.add("is-open");
    ui.comboInput.setAttribute("aria-expanded", "true");
    highlightCombo(0);
  }

  var zipStocked = 0;

  function updateZipHint() {
    var code = ui.country.value;
    var state = (ui.state && ui.state.value) || "";
    var count = ui.zip.options.length - 1;

    if (!code) {
      ui.zipHint.textContent = "Select country first";
      return;
    }

    if (state && count) {
      ui.zipHint.textContent =
        count + " ZIP code" + (count === 1 ? "" : "s") + " in " + state +
        ", " + countryName(code) +
        (zipStocked ? " · " + zipStocked + " with listings" : "");
      return;
    }

    var total = ZIP_TOTALS[code] || count;
    ui.zipHint.textContent =
      total + " ZIP code" + (total === 1 ? "" : "s") + " in " + countryName(code) +
      (total > count ? " (showing the first " + count + ")" : "") +
      (total ? " · " + zipStocked + " with listings" : "") +
      (verifiedCount(code) ? " · " + verifiedCount(code) + " verified" : "");
  }

  // --- postcode verification (Geoapify) ------------------------------------
  function isVerified(country, code) {
    return Boolean(country && code && verifiedAt[country] && verifiedAt[country][code]);
  }

  function verifiedCount(country) {
    return country && verifiedAt[country] ? Object.keys(verifiedAt[country]).length : 0;
  }

  function noteVerified(country, code, place) {
    if (!verifiedAt[country]) verifiedAt[country] = {};
    verifiedAt[country][code] = true;
    if (place) {
      EMBEDDED_PLACES = EMBEDDED_PLACES || {};
      EMBEDDED_PLACES[country] = EMBEDDED_PLACES[country] || {};
      EMBEDDED_PLACES[country][code] = place;
    }
  }

  function updateZipCheck() {
    var country = ui.country.value;
    var code = ui.zip.value;

    ui.zipCheck.classList.remove("is-ok", "is-bad");
    if (!country || !code) {
      ui.zipCheck.hidden = true;
      ui.zipCheckBtn.hidden = true;
      ui.zipCheckText.textContent = "";
      return;
    }

    ui.zipCheck.hidden = false;
    var places = EMBEDDED_PLACES && EMBEDDED_PLACES[country];
    var place = places && places[code];

    if (isVerified(country, code)) {
      ui.zipCheck.classList.add("is-ok");
      ui.zipCheckText.textContent = "✓ " + code + (place ? " — " + place : "") + " · confirmed by Geoapify";
      ui.zipCheckBtn.hidden = true;
      return;
    }

    ui.zipCheckText.textContent = "Sample code, not confirmed yet.";
    ui.zipCheckBtn.hidden = false;
    ui.zipCheckBtn.disabled = false;
  }

  function checkWithGeoapify() {
    var country = ui.country.value;
    var code = ui.zip.value;
    if (!country || !code) return;

    ui.zipCheckBtn.disabled = true;
    ui.zipCheck.hidden = false;
    ui.zipCheck.classList.remove("is-ok", "is-bad");
    ui.zipCheckText.textContent = "Checking " + code + "…";

    fetch("/api/postcode?country=" + encodeURIComponent(country) + "&code=" + encodeURIComponent(code))
      .then(function (response) {
        return response.json().then(function (body) {
          return { ok: response.ok, status: response.status, body: body };
        });
      })
      .then(function (result) {
        ui.zipCheckBtn.disabled = false;
        if (result.ok && result.body && result.body.verified) {
          var place = result.body.place || "";
          noteVerified(country, code, place);
          refreshZipLabels(country);
          updateZipHint();
          ui.zipCheck.classList.add("is-ok");
          ui.zipCheckText.textContent = "✓ " + code + (place ? " — " + place : "") + " · confirmed by Geoapify";
          ui.zipCheckBtn.hidden = true;
          return;
        }
        if (result.status === 404) {
          ui.zipCheck.classList.add("is-bad");
          ui.zipCheckText.textContent = "Geoapify has no record of " + code + " in " + countryName(country) + ".";
          return;
        }
        ui.zipCheckText.textContent = (result.body && result.body.error) || "Could not check right now.";
      })
      .catch(function () {
        ui.zipCheckBtn.disabled = false;
        ui.zipCheckText.textContent = "Could not reach the lookup service.";
      });
  }

  // relabel the current options without rebuilding them (keeps the selection)
  function refreshZipLabels(country) {
    var places = EMBEDDED_PLACES && EMBEDDED_PLACES[country];
    Array.prototype.forEach.call(ui.zip.options, function (option) {
      if (!option.value) return;
      var label = places && places[option.value] ? option.value + " — " + places[option.value] : option.value;
      if (isVerified(country, option.value)) label = "✓ " + label;
      option.textContent = label;
    });
  }

  // --- the ZIP select follows the chosen country ---------------------------
  function fetchZips(code) {
    if (zipLoading[code]) return;
    zipLoading[code] = true;

    fetch(SPLIT_DIR + code + ".json")
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (payload) {
        ZIPS[code] = payload.codes || [];
        ZIP_TOTALS[code] = ZIPS[code].length;
        if (payload.places) {
          EMBEDDED_PLACES = EMBEDDED_PLACES || {};
          EMBEDDED_PLACES[code] = payload.places;
        }
      })
      .catch(function () {
        ZIPS[code] = fallbackZips(code);
      })
      .then(function () {
        zipLoading[code] = false;
        if (ui.country.value === code) refreshZips(code);
      });
  }

  function refreshZips(code) {
    if (code && SPLIT_DIR && !ZIPS[code]) {
      ui.zip.innerHTML = "";
      var wait = document.createElement("option");
      wait.value = "";
      wait.textContent = "Loading…";
      ui.zip.appendChild(wait);
      ui.zip.disabled = true;
      ui.zipHint.textContent = "Loading ZIP codes for " + countryName(code) + "…";
      ui.zipCheck.hidden = true;
      fetchZips(code);
      return;
    }

    var codes = (code && ZIPS[code]) || [];

    // A state pins the postal codes: every listing in one state shares that
    // state's code, so picking a state narrows the select to it.
    var state = (ui.state && ui.state.value) || "";
    if (code && state) {
      var only = zipForState(code, state);
      var narrowed = codes.filter(function (zip) {
        return zip === only;
      });
      codes = narrowed.length ? narrowed : only ? [only] : codes;
    }

    ui.zip.innerHTML = "";
    var all = document.createElement("option");
    all.value = "";
    all.textContent = codes.length ? "All ZIP codes" : "—";
    ui.zip.appendChild(all);

    var table = (EMBEDDED_PLACES && EMBEDDED_PLACES[code]) || null;

    // Which of these postal codes actually have a seller behind them? With a
    // full national dataset that matters: most codes have no listings.
    var counts = {};
    GOODS.forEach(function (item) {
      if (item.country !== code) return;
      counts[item.zip] = (counts[item.zip] || 0) + 1;
    });
    var stocked = 0;
    zipStocked = 0;

    codes.forEach(function (zip) {
      var option = document.createElement("option");
      option.value = zip;
      var label = table && table[zip] ? zip + " — " + table[zip] : zip;
      if (isVerified(code, zip)) label = "✓ " + label;
      if (counts[zip]) {
        stocked += 1;
        label += " · " + counts[zip] + (counts[zip] === 1 ? " item" : " items");
      }
      option.textContent = label;
      ui.zip.appendChild(option);
    });

    ui.zip.value = "";
    ui.zip.disabled = codes.length === 0;
    zipStocked = stocked;

    ui.zip.value = "";
    updateZipHint();
    updateZipCheck();
  }

  // choosing a country applies it straight away
  function applyCountry(code) {
    ui.country.value = code || "";
    ui.comboInput.value = countryLabel(code || "");
    ui.comboHint.textContent = code
      ? "Filtering by " + countryName(code) + " (" + code + ")."
      : "Type a code or name and press enter, or open the list.";
    // state and city belong to the old country: clear them before the ZIP
    // list is rebuilt, or it would narrow to a state that is about to go
    if (ui.state) {
      ui.state.value = "";
      refreshStates();
    }
    if (ui.city) {
      ui.city.value = "";
      refreshCities();
    }
    ui.bank.value = "";
    refreshBanks();
    refreshZips(code);
    closeCombo();
    // the table waits for Search; picking a country only fills the lists
  }

  function chooseComboCode(code) {
    applyCountry(code);
  }

  ui.comboInput.addEventListener("focus", function () {
    ui.comboInput.select();
  });

  ui.comboInput.addEventListener("input", function () {
    // typing starts a fresh search, so the old filter stops applying until it
    // resolves again
    ui.country.value = "";
    openCombo();
  });

  ui.comboToggle.addEventListener("click", function () {
    if (ui.comboList.hidden) {
      ui.comboInput.focus();
      openCombo();
    } else {
      closeCombo();
    }
  });

  ui.comboList.addEventListener("mousedown", function (event) {
    // mousedown, not click: the input keeps focus so nothing closes underneath
    var option = event.target.closest(".combo__option");
    if (!option) return;
    event.preventDefault();
    chooseComboCode(option.dataset.code || "");
  });

  ui.comboInput.addEventListener("keydown", function (event) {
    var open = !ui.comboList.hidden;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openCombo();
        return;
      }
      combo.moved = true;
      highlightCombo(combo.active + (event.key === "ArrowDown" ? 1 : -1));
      return;
    }

    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        closeCombo();
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      // typing the abbreviation or the name and pressing enter is enough —
      // the list only takes over once the user has arrowed through it
      var resolved = resolveCountry(ui.comboInput.value);
      var active = open ? ui.comboList.querySelector(".combo__option.is-active") : null;

      if (resolved && !combo.moved) {
        chooseComboCode(resolved[0]);
      } else if (active) {
        chooseComboCode(active.dataset.code || "");
      } else if (resolved) {
        chooseComboCode(resolved[0]);
      } else {
        applyCountry("");
      }
    }
  });

  document.addEventListener("click", function (event) {
    if (!ui.combo.contains(event.target)) closeCombo();
  });

  applyCountry("");
  // --- Banks: the list depends on the country chosen above -----------------
  function refreshBanks() {
    var code = ui.country.value.toUpperCase();

    if (!code) {
      fillSelect(ui.bank, [], "Select country first");
      ui.bank.disabled = true;
      return;
    }

    var names = BANK_NAMES[code] || [];
    fillSelect(ui.bank, names, names.length ? "All banks" : "No banks listed");
    ui.bank.disabled = names.length === 0;
  }
  fillSelect(ui.refund, REFUNDS);
  fillSelect(ui.level, LEVEL_FILTER);
  fillSelect(ui.refresh, REFRESH_FILTER);
  fillSelect(ui.creator, unique(GOODS.map(function (g) { return g.creator; })).sort());

  // --- States: the list depends on the country chosen above -----------------
  function refreshStates() {
    var code = ui.country.value.toUpperCase();

    if (!code) {
      fillSelect(ui.state, [], "Select country first");
      ui.state.disabled = true;
      return;
    }

    var names = STATE_NAMES[code] || [];
    fillSelect(ui.state, names, names.length ? "All states" : "No states listed");
    ui.state.disabled = names.length === 0;
  }

  // --- Cities: the list depends on the state above -------------------------
  function refreshCities() {
    var code = ui.country.value.toUpperCase();
    var state = ui.state.value;

    if (!code) {
      fillSelect(ui.city, [], "Select country first");
      ui.city.disabled = true;
      return;
    }

    if (!state) {
      fillSelect(ui.city, [], "Select state first");
      ui.city.disabled = true;
      return;
    }

    var byState = CITY_NAMES[code] || {};
    var names = byState[state] || [];
    fillSelect(ui.city, names, names.length ? "All cities" : "No cities listed");
    ui.city.disabled = names.length === 0;
  }

  ui.state.addEventListener("change", function () {
    ui.city.value = "";
    refreshCities();
    refreshZips(ui.country.value);
  });

  // Nothing below renders: every filter waits for the Search button.

  ui.city.addEventListener("change", function () {
    refreshZips(ui.country.value);
  });

  ui.creator.addEventListener("change", function () {
    // keeps the dependent lists in step; the table waits for Search
  });

  refreshStates();
  refreshCities();
  refreshBanks();

  // --- price range --------------------------------------------------------
  var MAX_PRICE = 500;

  function setRange(lo, hi, source) {
    lo = Math.max(0, Math.min(MAX_PRICE, Number(lo) || 0));
    hi = Math.max(0, Math.min(MAX_PRICE, Number(hi) || 0));
    if (lo > hi) {
      var swap = lo;
      lo = hi;
      hi = swap;
    }

    ui.priceMin.value = lo;
    ui.priceMax.value = hi;
    if (source !== "min") ui.priceMinNum.value = lo;
    if (source !== "max") ui.priceMaxNum.value = hi;

    var left = (lo / MAX_PRICE) * 100;
    var right = 100 - (hi / MAX_PRICE) * 100;
    ui.rangeFill.style.left = left + "%";
    ui.rangeFill.style.right = right + "%";
    ui.rangeHint.textContent = "$" + lo + " - $" + hi;
  }

  ui.zip.addEventListener("change", updateZipCheck);
  ui.zipCheckBtn.addEventListener("click", checkWithGeoapify);

  ui.priceMin.addEventListener("input", function () {
    setRange(ui.priceMin.value, ui.priceMax.value, "min");
  });
  ui.priceMax.addEventListener("input", function () {
    setRange(ui.priceMin.value, ui.priceMax.value, "max");
  });
  ui.priceMinNum.addEventListener("change", function () {
    setRange(ui.priceMinNum.value, ui.priceMax.value);
  });
  ui.priceMaxNum.addEventListener("change", function () {
    setRange(ui.priceMin.value, ui.priceMaxNum.value);
  });
  setRange(0, MAX_PRICE);

  /* ---------------------- 4. Filtering + rendering ------------------------- */

  function checked(id) {
    var input = document.getElementById(id);
    return Boolean(input && input.checked);
  }

  /* ---------------------------- the search ------------------------------
     Filters do nothing until Search is pressed: closing a dropdown, typing an
     Id or picking a country only changes what the form holds. snapshot() takes
     a copy of every control, and matches() only ever reads that copy, so the
     table cannot change underneath someone who is still choosing. */
  var APPLIED = null;

  function snapshot() {
    return {
      country: ui.country.value || "",
      zip: ui.zip.value || "",
      bank: ui.bank.value || "",
      id: ui.id.value || "",
      refund: ui.refund.value || "",
      level: ui.level.value || "",
      refresh: ui.refresh.value || "",
      creator: ui.creator.value || "",
      state: ui.state.value || "",
      city: ui.city.value || "",
      tags: ui.tags.value || "",
      priceMin: Number(ui.priceMin.value),
      priceMax: Number(ui.priceMax.value),
      flags: {
        discounted: checked("fDiscounted"),
        refundable: checked("fRefundable"),
        recent: checked("fRecent"),
        source: checked("fSource"),
        docs: checked("fDocs"),
        samples: checked("fSamples"),
        commercial: checked("fCommercial"),
        beginner: checked("fBeginner"),
        autolayout: checked("fAutolayout"),
        tokens: checked("fTokens"),
        dark: checked("fDark"),
      },
    };
  }

  function matches(item) {
    var f = APPLIED || snapshot();

    if (f.country && item.country !== f.country) return false;
    if (f.zip && item.zip !== f.zip) return false;
    if (f.bank && item.bank !== f.bank) return false;

    // Id filter: one catalogue id, or several separated by commas/spaces. A
    // fragment matches, so "412" narrows to every 412xxx listing.
    var idTokens = f.id
      .split(/[,\s]+/)
      .map(function (t) { return t.trim().toLowerCase(); })
      .filter(Boolean);
    if (idTokens.length) {
      var hit = idTokens.some(function (token) {
        return item.id.toLowerCase().indexOf(token) !== -1;
      });
      if (!hit) return false;
    }

    if (f.refund && item.refund !== f.refund) return false;
    if (f.level && item.plan !== f.level) return false;
    if (f.refresh) {
      var newest = GOODS.reduce(function (top, g) {
        return Math.max(top, refreshKey(g));
      }, 0);
      var thisMonth = refreshKey(item) === newest;
      if (f.refresh === "This month" && !thisMonth) return false;
      if (f.refresh === "Earlier" && thisMonth) return false;
    }

    if (f.creator && item.creator !== f.creator) return false;
    if (f.state && item.state !== f.state) return false;
    if (f.city && item.city !== f.city) return false;

    if (item.price < f.priceMin) return false;
    if (item.price > f.priceMax) return false;

    if (f.flags.discounted && !item.discount) return false;
    if (f.flags.refundable && !item.refundable) return false;
    if (f.flags.recent && !item.recent) return false;
    if (f.flags.source && !item.features.source) return false;
    if (f.flags.docs && !item.features.docs) return false;
    if (f.flags.samples && !item.features.samples) return false;
    if (f.flags.commercial && !item.features.commercial) return false;
    if (f.flags.beginner && !item.features.beginner) return false;
    if (f.flags.autolayout && !item.features.autolayout) return false;
    if (f.flags.tokens && !item.features.tokens) return false;
    if (f.flags.dark && !item.features.dark) return false;

    var tags = f.tags
      .split(",")
      .map(function (t) { return t.trim().toLowerCase(); })
      .filter(Boolean);

    if (tags.length) {
      var haystack = item.tags.join(" ") + " " + item.title.toLowerCase();
      var missing = tags.some(function (tag) {
        return haystack.indexOf(tag) === -1;
      });
      if (missing) return false;
    }

    return true;
  }

  var STAR =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 3 2.7 5.9 6.3.7-4.7 4.3 1.3 6.1L12 16.9 6.4 20l1.3-6.1L3 9.6l6.3-.7Z"/></svg>';

  // A green tick / red cross, the way a dense listing table reads at a glance.
  function mark(ok, label) {
    var span = document.createElement("span");
    span.className = ok ? "mark mark--ok" : "mark mark--no";
    span.setAttribute("data-label", label);
    span.textContent = ok ? "\u2713" : "\u2715";
    return span;
  }

  // Mini flag + code, the same artwork the drop panels use.
  function flagFor(code) {
    var art = (window.NL_FLAGS || {})[code];
    if (!art) return null;
    var span = document.createElement("span");
    span.className = "flag";
    span.setAttribute("aria-hidden", "true");
    span.innerHTML = '<svg viewBox="0 0 30 21" focusable="false">' + art + "</svg>";
    return span;
  }

  // "Nov 26" -> "11/26": the same slot an expiry date uses in this layout.
  function refreshCode(updated) {
    var parts = String(updated || "").split(" ");
    var month = MONTHS.indexOf(parts[0]) + 1;
    if (!month) return "\u2014";
    return String(month).padStart(2, "0") + "/" + (parts[1] || "");
  }

  function row(item) {
    var tr = document.createElement("tr");

    // ---- Base: title (+ Premium chip) ----------------------------------
    var base = document.createElement("td");
    base.className = "rtable__item r-base";
    var title = document.createElement("span");
    title.className = "r-item__title";
    title.textContent = item.title;
    base.appendChild(title);
    if (item.premium) {
      var premium = document.createElement("span");
      premium.className = "chip-premium";
      premium.innerHTML = STAR + "<span>Premium</span>";
      base.appendChild(premium);
    }
    tr.appendChild(base);

    // ---- Seller: the storefront that fulfils the order, with the studio
    //      handle underneath so nothing is lost by having one column ---------
    var shop = document.createElement("td");
    shop.className = "r-shop";
    var shopName = document.createElement("span");
    shopName.className = "r-shop__name";
    shopName.textContent = SHOPS[item.creator] || item.creator;
    var shopHandle = document.createElement("span");
    shopHandle.className = "r-seller";
    shopHandle.textContent = item.creator;
    shop.appendChild(shopName);
    shop.appendChild(shopHandle);
    tr.appendChild(shop);

    // ---- Base quality --------------------------------------------------
    var quality = document.createElement("td");
    var qualityChip = document.createElement("span");
    qualityChip.className =
      "badge-quality" +
      (item.rating === "Top rated" ? " badge-quality--top" : item.rating === "New" ? " badge-quality--new" : "");
    qualityChip.textContent = item.rating;
    quality.appendChild(qualityChip);
    tr.appendChild(quality);

    // ---- Id (+ the file format, like a brand mark under the number) -----
    var id = document.createElement("td");
    id.className = "r-id";
    var idText = document.createElement("span");
    idText.className = "r-id__num";
    idText.textContent = item.id;
    var formatChip = document.createElement("span");
    formatChip.className = "chip-format";
    formatChip.textContent = item.format;
    id.appendChild(idText);
    id.appendChild(formatChip);
    tr.appendChild(id);

    // ---- Level: the licence tier ---------------------------------------
    var level = document.createElement("td");
    level.className = "r-level";
    level.textContent = item.plan;
    tr.appendChild(level);

    // ---- Refresh: when the files were last updated ---------------------
    var refresh = document.createElement("td");
    refresh.className = "r-mono r-refresh";
    refresh.textContent = refreshCode(item.updated);
    tr.appendChild(refresh);

    // ---- Support: how long updates and help last for this listing -------
    var support = document.createElement("td");
    support.className = "r-support";
    support.textContent = SUPPORT_BY_PLAN[item.plan] || "12 months";
    tr.appendChild(support);

    // ---- Address details: where the seller is registered ----------------
    var address = document.createElement("td");
    address.className = "r-address";
    var ok = document.createElement("b");
    ok.className = "r-address__ok";
    ok.textContent = "Address \u2713";
    address.appendChild(ok);
    [
      ["Country", item.countryName + " " + item.country],
      ["State", item.state],
      ["City", item.city],
      ["Zip", item.zip],
    ].forEach(function (pair) {
      if (!pair[1]) return;
      var line = document.createElement("span");
      line.textContent = pair[0] ? pair[0] + ": " + pair[1] : pair[1];
      address.appendChild(line);
    });
    tr.appendChild(address);

    // ---- Checks: what the seller has verified, tick by tick -------------
    var contact = document.createElement("td");
    contact.className = "r-checks";
    [
      ["Email", item.verified.email],
      ["Phone", item.verified.phone],
      ["DOB", item.verified.id],
      ["SSN", item.verified.address],
    ].forEach(function (pair) {
      var line = document.createElement("span");
      line.className = "r-checks__line";
      var name = document.createElement("em");
      name.textContent = pair[0];
      line.appendChild(name);
      line.appendChild(mark(pair[1], pair[0]));
      contact.appendChild(line);
    });
    tr.appendChild(contact);

    // ---- Special info: the flags the filters use ------------------------
    var special = document.createElement("td");
    special.className = "r-checks";
    [
      ["IP", item.discount],
      ["UA", item.refundable],
      ["DL", item.recent],
      ["MMN", item.features.beginner],
    ].forEach(function (pair) {
      var line = document.createElement("span");
      line.className = "r-checks__line";
      var name = document.createElement("em");
      name.textContent = pair[0];
      line.appendChild(name);
      line.appendChild(mark(pair[1], pair[0]));
      special.appendChild(line);
    });
    tr.appendChild(special);

    // ---- Bank name: the bank the seller's payouts clear through ---------
    var bank = document.createElement("td");
    bank.className = "r-bank";
    bank.textContent = item.bank || "\u2014";
    tr.appendChild(bank);

    // ---- Refundable ----------------------------------------------------
    var refund = document.createElement("td");
    refund.className = "r-refund";
    refund.appendChild(mark(item.refundable, "Refundable"));
    tr.appendChild(refund);

    // ---- Price ---------------------------------------------------------
    var price = document.createElement("td");
    price.className = "r-price";
    price.textContent = "$" + item.price.toFixed(2);
    tr.appendChild(price);

    // ---- Action: Buy (money moves on the server) + Cart -----------------
    var action = document.createElement("td");
    action.className = "r-action";

    var buyBtn = document.createElement("button");
    buyBtn.type = "button";
    buyBtn.className = "buy-btn";
    buyBtn.textContent = "Buy";
    buyBtn.setAttribute("data-buy", item.id);
    buyBtn.setAttribute("data-title", item.title);
    buyBtn.setAttribute("data-price", String(item.price));
    buyBtn.setAttribute("aria-label", "Buy " + item.title + " for $" + item.price.toFixed(2));
    action.appendChild(buyBtn);

    var cartBtn = document.createElement("button");
    cartBtn.type = "button";
    cartBtn.className = "cart-btn";
    cartBtn.textContent = "+ Cart";
    cartBtn.setAttribute("aria-label", "Add " + item.title + " to the cart");
    cartBtn.addEventListener("click", function () {
      if (!window.NLCart) return;
      window.NLCart.add({
        key: String(item.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
        title: item.title,
        price: item.price,
        qty: 1,
      });
      cartBtn.textContent = "Added \u2713";
      cartBtn.classList.add("is-added");
      setTimeout(function () {
        cartBtn.textContent = "+ Cart";
        cartBtn.classList.remove("is-added");
      }, 1400);
    });
    action.appendChild(cartBtn);
    tr.appendChild(action);

    return tr;
  }

  /* ------------------------------ 5. Buying ------------------------------- */
  /*  One click sends only the catalogue id: the server looks the price up in
      the same catalogue this page is built from, so the browser cannot name its
      own price. It answers 402 "Insufficient funds." when the wallet is short. */

  function buyMoney(value) {
    var n = Math.round(Number(value) * 100) / 100;
    return "$" + (isFinite(n) ? n : 0).toFixed(2);
  }

  function buyNote(message, tone) {
    if (!ui.note) return;
    if (!message) {
      ui.note.hidden = true;
      ui.note.textContent = "";
      return;
    }
    ui.note.hidden = false;
    ui.note.className = "buy-note buy-note--" + (tone || "info");
    ui.note.textContent = message;
  }

  // Keep the wallet in the top bar honest after a purchase.
  function paintWallet(balance) {
    if (typeof balance !== "number") return;
    var nodes = document.querySelectorAll(".js-balance");
    Array.prototype.forEach.call(nodes, function (node) {
      node.textContent = balance.toFixed(2);
    });
  }

  // Settings and Your Activities read this browser's order list.
  function recordOrder(price) {
    try {
      var orders = JSON.parse(window.localStorage.getItem("nl.orders.v1") || "[]");
      if (!Array.isArray(orders)) orders = [];
      orders.push({ at: Date.now(), total: price, items: 1 });
      window.localStorage.setItem("nl.orders.v1", JSON.stringify(orders));
    } catch (err) {
      /* storage blocked — the purchase still happened on the server */
    }
  }

  function buy(button) {
    if (button.disabled) return;

    var id = button.getAttribute("data-buy");
    var title = button.getAttribute("data-title");
    var price = Number(button.getAttribute("data-price")) || 0;

    button.disabled = true;
    button.textContent = "Buying\u2026";
    buyNote("", null);

    function restore() {
      button.disabled = false;
      button.textContent = "Buy";
      button.classList.remove("is-done");
    }

    fetch("api/purchase", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id }),
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            return { status: response.status, data: data };
          });
      })
      .then(function (result) {
        if (result.status === 201 && result.data.purchase) {
          button.textContent = "Bought";
          button.classList.add("is-done");
          paintWallet(result.data.balance);
          recordOrder(price);
          buyNote(
            title +
              " bought for " +
              buyMoney(price) +
              ". Your wallet holds " +
              buyMoney(result.data.balance) +
              ".",
            "ok"
          );
          window.setTimeout(restore, 2600);
          return;
        }

        if (result.status === 402) {
          buyNote(
            "Insufficient funds. " +
              title +
              " costs " +
              buyMoney(result.data.price || price) +
              " and your wallet holds " +
              buyMoney(result.data.balance),
            "bad"
          );
          restore();
          return;
        }

        if (result.status === 401) {
          buyNote("Sign in again to buy anything — your session has ended.", "bad");
          restore();
          return;
        }

        buyNote(result.data.error || "That did not go through. Try again.", "bad");
        restore();
      })
      .catch(function () {
        buyNote(
          "Can't reach the server. Start it with python3 server/app.py and try again.",
          "bad"
        );
        restore();
      });
  }

  // one listener for the whole table: rows are re-rendered on every filter
  ui.body.addEventListener("click", function (event) {
    var button = event.target.closest("[data-buy]");
    if (button) buy(button);
  });

  // ---------------------------- pager --------------------------------------
  var PAGE = 1;

  function pageSize() {
    var value = String(ui.pageSize.value);
    if (value === "all") return GOODS.length || 1;
    return Number(value) || 10;
  }

  function renderPager(total, pages) {
    var pager = $("#pager");
    if (!pager) return;
    pager.innerHTML = "";

    if (pages <= 1) {
      pager.hidden = true;
      return;
    }
    pager.hidden = false;

    function button(label, page, opts) {
      var config = opts || {};
      var el = document.createElement("button");
      el.type = "button";
      el.className = "pager__btn" + (config.current ? " is-current" : "");
      el.textContent = label;
      if (config.current) {
        el.setAttribute("aria-current", "page");
      }
      if (config.disabled) {
        el.disabled = true;
      } else {
        el.setAttribute("data-page", String(page));
      }
      if (config.label) el.setAttribute("aria-label", config.label);
      pager.appendChild(el);
    }

    button("\u2039", PAGE - 1, { disabled: PAGE <= 1, label: "Previous page" });

    // 1 ... 4 5 6 ... 12 — numbers near the current page, gaps as an ellipsis
    var wanted = {};
    wanted[1] = true;
    wanted[pages] = true;
    for (var i = PAGE - 1; i <= PAGE + 1; i++) {
      if (i >= 1 && i <= pages) wanted[i] = true;
    }
    var last = 0;
    Object.keys(wanted).map(Number).sort(function (a, b) { return a - b; })
      .forEach(function (page) {
        if (page - last > 1) {
          var gap = document.createElement("span");
          gap.className = "pager__gap";
          gap.textContent = "\u2026";
          pager.appendChild(gap);
        }
        button(String(page), page, { current: page === PAGE, label: "Page " + page });
        last = page;
      });

    button("\u203a", PAGE + 1, { disabled: PAGE >= pages, label: "Next page" });

    var count = document.createElement("span");
    count.className = "pager__count";
    count.textContent = total + (total === 1 ? " drop" : " drops");
    pager.appendChild(count);
  }

  function goToPage(page) {
    PAGE = page;
    render();
    var results = document.querySelector("section.results");
    if (results) {
      results.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function render() {
    var rows = GOODS.filter(matches);
    var limit = pageSize();
    var pages = Math.max(1, Math.ceil(rows.length / limit));
    if (PAGE > pages) PAGE = pages;
    if (PAGE < 1) PAGE = 1;

    var from = (PAGE - 1) * limit;
    var shown = rows.slice(from, from + limit);

    ui.body.innerHTML = "";
    shown.forEach(function (item) {
      ui.body.appendChild(row(item));
    });

    ui.table.hidden = shown.length === 0;
    ui.empty.hidden = shown.length !== 0;
    if (!GOODS.length) {
      ui.empty.textContent =
        "The catalogue did not load, so there is nothing to list. Refresh the " +
        "page; if it stays empty, assets/data/drops-data.js is missing.";
    } else if (APPLIED && APPLIED.zip) {
      ui.empty.textContent =
        "No seller is registered at ZIP " + APPLIED.zip + ". Showing 0 of " + GOODS.length + ".";
    } else {
      ui.empty.textContent = "No drops match these filters. Showing 0 of " + GOODS.length + ".";
    }

    renderPager(rows.length, pages);
  }

  function search() {
    // the Search button resolves a half-typed country too, so "ng" + Search works
    var typed = ui.comboInput.value.trim();
    if (typed && !ui.country.value) {
      var resolved = resolveCountry(typed);
      if (resolved) {
        applyCountry(resolved[0]);
      }
    }

    closeCombo();
    APPLIED = snapshot();   // this is the moment the filters take effect
    PAGE = 1;
    render();
  }

  ui.form.addEventListener("submit", function (event) {
    event.preventDefault();
    search();
  });

  // changing how many rows fit on a page does not re-run the filters
  ui.pageSize.addEventListener("change", function () {
    PAGE = 1;
    render();
  });

  // pager clicks
  var pagerEl = $("#pager");
  if (pagerEl) {
    pagerEl.addEventListener("click", function (event) {
      var target = event.target.closest("[data-page]");
      if (!target) return;
      goToPage(Number(target.getAttribute("data-page")) || 1);
    });
  }

  // typing in the tag box and pressing Enter runs the search
  ui.tags.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      search();
    }
  });

  APPLIED = snapshot();   // first paint: no filters, every drop on page 1
  render();
})();
