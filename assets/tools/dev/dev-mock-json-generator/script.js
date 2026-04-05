/**
 * =============================================================================
 *  QA MOCK DATA STUDIO — ENGINE v5.1  (CodeCanyon Global Edition)
 * =============================================================================
 *  Generates statistically valid synthetic identities for software QA testing.
 *  Supports 195 countries with locale-appropriate names, phone patterns, and
 *  address data.  Payment tokens are Luhn-Algorithm valid but strictly
 *  fictitious — for sandbox / Dev environments only.
 *
 *  Architecture   : Revealing-Module Pattern (IIFE) — zero global pollution.
 *  Public API     : MockStudio.init()  — called on DOMContentLoaded
 *                   MockStudio.copy()  — called by onclick on each data card
 *
 *  @author        MD KAWSAR
 *  @copyright     2026 TrustedToolsWeb
 *  @version       5.1
 *  @license       CodeCanyon Standard / Extended License
 * =============================================================================
 */

const MockStudio = (function () {
    'use strict';

    /* =========================================================================
       §1 — PRIVATE STATE
       currentState: a plain object that mirrors the last generated identity.
       Populated by generateIdentity() and read by downloadJSON() / copy().
    ========================================================================= */

    /** @type {Object} Holds the most recently generated identity fields. */
    let currentState = {};

    /* =========================================================================
       §2 — LOCALE NAME DATA
       Keyed by ISO-639-1 language code.  Each entry contains:
         f → array of common given (first) names for that locale
         l → array of common family (last) names for that locale
       Used by generateIdentity() to produce culturally appropriate full names.
    ========================================================================= */

    const nameData = {
        "en": { f: ["James","John","Robert","Michael","William","David","Richard","Emma","Olivia","Ava","Isabella","Sophia","Charlotte"], l: ["Smith","Johnson","Williams","Brown","Jones","Miller","Davis","Garcia","Rodriguez","Wilson"] },
        "es": { f: ["Santiago","Mateo","Sebastián","Leonardo","Alejandro","Sofía","Valentina","Isabella","Camila","Valeria"], l: ["González","Rodríguez","Gómez","Fernández","López","Díaz","Martínez","Pérez","García","Sánchez"] },
        "fr": { f: ["Gabriel","Léo","Raphaël","Louis","Arthur","Jules","Louise","Jade","Alice","Chloé","Emma"], l: ["Martin","Bernard","Thomas","Petit","Robert","Richard","Durand","Dubois","Moreau","Laurent"] },
        "de": { f: ["Paul","Jonas","Leon","Finn","Elias","Noah","Mia","Emma","Hannah","Sofia","Emilia"], l: ["Müller","Schmidt","Schneider","Fischer","Weber","Meyer","Wagner","Becker","Schulz","Hoffmann"] },
        "it": { f: ["Leonardo","Francesco","Alessandro","Lorenzo","Mattia","Sofia","Giulia","Aurora","Alice","Ginevra"], l: ["Rossi","Russo","Ferrari","Esposito","Bianchi","Romano","Colombo","Ricci","Marino"] },
        "pt": { f: ["João","Miguel","Lucas","Pedro","Gabriel","Maria","Ana","Francisca","Leonor","Matilde"], l: ["Silva","Santos","Ferreira","Pereira","Oliveira","Costa","Rodrigues","Martins","Jesus"] },
        "ru": { f: ["Alexander","Sergey","Dmitry","Ivan","Maxim","Anastasia","Maria","Daria","Anna","Victoria"], l: ["Ivanov","Smirnov","Kuznetsov","Popov","Sokolov","Lebedev","Kozlov","Novikov"] },
        "ja": { f: ["Haruto","Sota","Yuto","Minato","Riku","Yui","Rio","Hina","Mei","Sakura"], l: ["Sato","Suzuki","Takahashi","Tanaka","Watanabe","Ito","Nakamura","Kobayashi"] },
        "zh": { f: ["Wei","Hao","Yi","Jun","Ming","Fang","Na","Min","Jing","Yan"], l: ["Li","Wang","Zhang","Liu","Chen","Yang","Huang","Zhao","Wu","Zhou"] },
        "ko": { f: ["Min-jun","Seo-jun","Do-yun","Ye-jun","Ji-an","Seo-ah","Ha-eun","Ji-yoon"], l: ["Kim","Lee","Park","Choi","Jung","Kang","Jo","Yoon","Jang"] },
        "ar": { f: ["Muhammad","Omar","Ali","Yusuf","Ahmed","Ibrahim","Fatima","Maryam","Aisha","Zainab","Noor"], l: ["Khan","Ali","Ahmed","Hassan","Ibrahim","Mahmoud","Abdullah","Hussein","Saleh"] },
        "hi": { f: ["Aarav","Vihaan","Aditya","Sai","Reyansh","Saanvi","Aadya","Diya","Ananya","Kiara"], l: ["Kumar","Sharma","Singh","Patel","Gupta","Mishra","Reddy","Verma","Mehta"] },
        "si": { f: ["Malin","Kasun","Ruwan","Nuwan","Chamara","Nadeesha","Dilani","Chamari"], l: ["Perera","Fernando","Silva","De Silva","Bandara","Wickramasinghe"] },
        "tr": { f: ["Yusuf","Eymen","Omer","Miraç","Mustafa","Zeynep","Elif","Defne","Hiranur"], l: ["Yilmaz","Kaya","Demir","Çelik","Şahin","Yildiz","Yildirim","Öztürk"] },
        "pl": { f: ["Antoni","Jan","Jakub","Franciszek","Szymon","Julia","Zuzanna","Zofia","Hanna"], l: ["Nowak","Kowalski","Wiśniewski","Wójcik","Kowalczyk","Kamiński","Lewandowski"] },
        "sv": { f: ["Lars","Mikael","Anders","Karl","Erik","Maria","Anna","Margareta","Elisabeth"], l: ["Andersson","Johansson","Karlsson","Nilsson","Eriksson","Larsson","Olsson"] }
    };

    /* =========================================================================
       §3 — REGIONAL ADDRESS DATA
       Keyed by a regional group string (matching worldDB[code].r).
       Each entry contains:
         s → array of street-name patterns
         c → array of city objects { c: city, s: state/region, z: zip/postal }
       Designed to cover the major geographic groups without requiring a
       separate dataset per country.
    ========================================================================= */

    const regionData = {
        "US":     { s: ["Main St", "Oak St", "Pine Rd", "Maple Ave", "Cedar Ln", "Washington Blvd"],              c: [{c:"New York",s:"NY",z:"10001"},{c:"Los Angeles",s:"CA",z:"90001"},{c:"Chicago",s:"IL",z:"60601"},{c:"Houston",s:"TX",z:"77001"}] },
        "UK":     { s: ["High St", "Station Rd", "London Rd", "Victoria St", "Church Ln", "Manor Park"],           c: [{c:"London",s:"ENG",z:"SW1A 1AA"},{c:"Manchester",s:"ENG",z:"M1 1AD"},{c:"Edinburgh",s:"SCT",z:"EH1 1BB"}] },
        "EU_W":   { s: ["Rue de la Paix", "Avenue Victor Hugo", "Place de la Concorde", "Boulevard Saint-Germain"], c: [{c:"Paris",s:"IDF",z:"75001"},{c:"Lyon",s:"ARA",z:"69002"},{c:"Marseille",s:"PAC",z:"13001"}] },
        "EU_C":   { s: ["Hauptstraße", "Bahnhofstraße", "Lindenstraße", "Ringstraße", "Schulstraße"],               c: [{c:"Berlin",s:"BE",z:"10115"},{c:"Munich",s:"BY",z:"80331"},{c:"Vienna",s:"VIE",z:"1010"}] },
        "EU_S":   { s: ["Via Roma", "Corso Vittorio Emanuele", "Piazza Garibaldi", "Calle Mayor"],                  c: [{c:"Rome",s:"LAZ",z:"00100"},{c:"Madrid",s:"MD",z:"28001"},{c:"Lisbon",s:"LIS",z:"1000"}] },
        "LATAM":  { s: ["Avenida Bolivar", "Calle San Martin", "Avenida Libertador", "Rua das Flores"],             c: [{c:"Mexico City",s:"CMX",z:"01000"},{c:"São Paulo",s:"SP",z:"01000"},{c:"Buenos Aires",s:"CABA",z:"C1001"}] },
        "ASIA_E": { s: ["Chuo-dori", "Nanjing Road", "Orchard Road", "Teheran-ro"],                                 c: [{c:"Tokyo",s:"13",z:"100-0001"},{c:"Seoul",s:"SEO",z:"04524"},{c:"Beijing",s:"BJ",z:"100000"}] },
        "ASIA_S": { s: ["MG Road", "Station Road", "Park Street", "Main Bazaar"],                                   c: [{c:"Mumbai",s:"MH",z:"400001"},{c:"Delhi",s:"DL",z:"110001"},{c:"Colombo",s:"WP",z:"00100"}] },
        "ME":     { s: ["King Fahd Road", "Sheikh Zayed Road", "Istiklal Avenue", "Nile Corniche"],                 c: [{c:"Dubai",s:"DU",z:"00000"},{c:"Riyadh",s:"RI",z:"11564"},{c:"Istanbul",s:"IST",z:"34000"}] },
        "GENERIC":{ s: ["Central Ave", "North St", "Airport Rd", "Market St", "Harbor View"],                      c: [{c:"Capital City",s:"CC",z:"10000"},{c:"Port Town",s:"PT",z:"20000"}] }
    };

    /* =========================================================================
       §4 — WORLD COUNTRY DATABASE (195 entries)
       Keyed by ISO-3166-1 alpha-2 country code.  Each entry contains:
         n → full English country name
         r → regional group key (maps to regionData)
         p → phone number pattern — '#' is replaced with a random digit
         l → language code (maps to nameData)
    ========================================================================= */

    const worldDB = {
        "AF": { n: "Afghanistan", r: "ME", p: "+93 7## ### ###", l: "ar" }, "AL": { n: "Albania", r: "EU_S", p: "+355 6# ### ####", l: "it" }, "DZ": { n: "Algeria", r: "ME", p: "+213 5## ### ###", l: "ar" }, "AD": { n: "Andorra", r: "EU_S", p: "+376 ### ###", l: "es" }, "AO": { n: "Angola", r: "GENERIC", p: "+244 9## ### ###", l: "pt" }, "AG": { n: "Antigua & Barbuda", r: "US", p: "+1 268-###-####", l: "en" },
        "AR": { n: "Argentina", r: "LATAM", p: "+54 9 11 #### ####", l: "es" }, "AM": { n: "Armenia", r: "EU_C", p: "+374 9# ### ###", l: "ru" }, "AU": { n: "Australia", r: "US", p: "+61 4## ### ###", l: "en" }, "AT": { n: "Austria", r: "EU_C", p: "+43 6## #######", l: "de" }, "AZ": { n: "Azerbaijan", r: "ME", p: "+994 5# ### ## ##", l: "tr" }, "BS": { n: "Bahamas", r: "US", p: "+1 242-###-####", l: "en" },
        "BH": { n: "Bahrain", r: "ME", p: "+973 3### ####", l: "ar" }, "BD": { n: "Bangladesh", r: "ASIA_S", p: "+880 1#########", l: "hi" }, "BB": { n: "Barbados", r: "US", p: "+1 246-###-####", l: "en" }, "BY": { n: "Belarus", r: "EU_C", p: "+375 29 ### ## ##", l: "ru" }, "BE": { n: "Belgium", r: "EU_W", p: "+32 4## ## ## ##", l: "fr" }, "BZ": { n: "Belize", r: "LATAM", p: "+501 ###-####", l: "en" },
        "BJ": { n: "Benin", r: "GENERIC", p: "+229 ## ## ## ##", l: "fr" }, "BT": { n: "Bhutan", r: "ASIA_S", p: "+975 17 ## ## ##", l: "hi" }, "BO": { n: "Bolivia", r: "LATAM", p: "+591 7### ####", l: "es" }, "BA": { n: "Bosnia & Herzegovina", r: "EU_S", p: "+387 6# ### ###", l: "pl" }, "BW": { n: "Botswana", r: "GENERIC", p: "+267 7# ### ###", l: "en" }, "BR": { n: "Brazil", r: "LATAM", p: "+55 11 9####-####", l: "pt" },
        "BN": { n: "Brunei", r: "ASIA_E", p: "+673 8## ####", l: "en" }, "BG": { n: "Bulgaria", r: "EU_S", p: "+359 8# ### ####", l: "ru" }, "BF": { n: "Burkina Faso", r: "GENERIC", p: "+226 ## ## ## ##", l: "fr" }, "BI": { n: "Burundi", r: "GENERIC", p: "+257 7# ## ## ##", l: "fr" }, "KH": { n: "Cambodia", r: "ASIA_E", p: "+855 1# ### ###", l: "en" }, "CM": { n: "Cameroon", r: "GENERIC", p: "+237 6## ## ## ##", l: "fr" },
        "CA": { n: "Canada", r: "US", p: "+1 ###-###-####", l: "en" }, "CV": { n: "Cape Verde", r: "GENERIC", p: "+238 9## ## ##", l: "pt" }, "CF": { n: "Central African Rep", r: "GENERIC", p: "+236 7# ## ## ##", l: "fr" }, "TD": { n: "Chad", r: "GENERIC", p: "+235 6# ## ## ##", l: "ar" }, "CL": { n: "Chile", r: "LATAM", p: "+56 9 #### ####", l: "es" }, "CN": { n: "China", r: "ASIA_E", p: "+86 1## #### ####", l: "zh" },
        "CO": { n: "Colombia", r: "LATAM", p: "+57 3## ### ####", l: "es" }, "KM": { n: "Comoros", r: "GENERIC", p: "+269 3## ## ##", l: "ar" }, "CG": { n: "Congo (Brazzaville)", r: "GENERIC", p: "+242 06 ### ## ##", l: "fr" }, "CD": { n: "Congo (Kinshasa)", r: "GENERIC", p: "+243 8# ### ####", l: "fr" }, "CR": { n: "Costa Rica", r: "LATAM", p: "+506 #### ####", l: "es" }, "HR": { n: "Croatia", r: "EU_S", p: "+385 9# ### ####", l: "pl" },
        "CU": { n: "Cuba", r: "LATAM", p: "+53 5 ### ####", l: "es" }, "CY": { n: "Cyprus", r: "EU_S", p: "+357 9# ### ###", l: "en" }, "CZ": { n: "Czechia", r: "EU_C", p: "+420 ### ### ###", l: "de" }, "DK": { n: "Denmark", r: "EU_C", p: "+45 ## ## ## ##", l: "sv" }, "DJ": { n: "Djibouti", r: "ME", p: "+253 77 ## ## ##", l: "fr" }, "DM": { n: "Dominica", r: "US", p: "+1 767-###-####", l: "en" },
        "DO": { n: "Dominican Republic", r: "LATAM", p: "+1 8##-###-####", l: "es" }, "EC": { n: "Ecuador", r: "LATAM", p: "+593 9## ### ###", l: "es" }, "EG": { n: "Egypt", r: "ME", p: "+20 1# #### ####", l: "ar" }, "SV": { n: "El Salvador", r: "LATAM", p: "+503 7### ####", l: "es" }, "GQ": { n: "Equatorial Guinea", r: "GENERIC", p: "+240 222 ## ## ##", l: "es" }, "ER": { n: "Eritrea", r: "GENERIC", p: "+291 7 ## ## ##", l: "ar" },
        "EE": { n: "Estonia", r: "EU_C", p: "+372 5### ####", l: "sv" }, "SZ": { n: "Eswatini", r: "GENERIC", p: "+268 76## ####", l: "en" }, "ET": { n: "Ethiopia", r: "GENERIC", p: "+251 9## #####", l: "en" }, "FJ": { n: "Fiji", r: "US", p: "+679 7## ####", l: "en" }, "FI": { n: "Finland", r: "EU_C", p: "+358 4# ### ####", l: "sv" }, "FR": { n: "France", r: "EU_W", p: "+33 6 ## ## ## ##", l: "fr" },
        "GA": { n: "Gabon", r: "GENERIC", p: "+241 07 ## ## ##", l: "fr" }, "GM": { n: "Gambia", r: "GENERIC", p: "+220 7## ####", l: "en" }, "GE": { n: "Georgia", r: "EU_C", p: "+995 5## ## ## ##", l: "ru" }, "DE": { n: "Germany", r: "EU_C", p: "+49 1## #######", l: "de" }, "GH": { n: "Ghana", r: "GENERIC", p: "+233 2# ### ####", l: "en" }, "GR": { n: "Greece", r: "EU_S", p: "+30 69# ### ####", l: "en" },
        "GD": { n: "Grenada", r: "US", p: "+1 473-###-####", l: "en" }, "GT": { n: "Guatemala", r: "LATAM", p: "+502 5### ####", l: "es" }, "GN": { n: "Guinea", r: "GENERIC", p: "+224 6## ## ## ##", l: "fr" }, "GW": { n: "Guinea-Bissau", r: "GENERIC", p: "+245 9# ### ####", l: "pt" }, "GY": { n: "Guyana", r: "LATAM", p: "+592 6## ####", l: "en" }, "HT": { n: "Haiti", r: "LATAM", p: "+509 3### ####", l: "fr" },
        "HN": { n: "Honduras", r: "LATAM", p: "+504 9###-####", l: "es" }, "HU": { n: "Hungary", r: "EU_C", p: "+36 30 ### ####", l: "de" }, "IS": { n: "Iceland", r: "EU_C", p: "+354 ### ####", l: "sv" }, "IN": { n: "India", r: "ASIA_S", p: "+91 9#########", l: "hi" }, "ID": { n: "Indonesia", r: "ASIA_S", p: "+62 8## #### ####", l: "en" }, "IR": { n: "Iran", r: "ME", p: "+98 9## ### ####", l: "ar" },
        "IQ": { n: "Iraq", r: "ME", p: "+964 7## ### ####", l: "ar" }, "IE": { n: "Ireland", r: "UK", p: "+353 8# ### ####", l: "en" }, "IL": { n: "Israel", r: "EU_C", p: "+972 5# ### ####", l: "en" }, "IT": { n: "Italy", r: "EU_S", p: "+39 3## #######", l: "it" }, "JM": { n: "Jamaica", r: "US", p: "+1 876-###-####", l: "en" }, "JP": { n: "Japan", r: "ASIA_E", p: "+81 90-####-####", l: "ja" },
        "JO": { n: "Jordan", r: "ME", p: "+962 7 # ### ####", l: "ar" }, "KZ": { n: "Kazakhstan", r: "EU_C", p: "+7 7## ### ## ##", l: "ru" }, "KE": { n: "Kenya", r: "GENERIC", p: "+254 7## ### ###", l: "en" }, "KI": { n: "Kiribati", r: "US", p: "+686 7####", l: "en" }, "KP": { n: "North Korea", r: "ASIA_E", p: "+850 191 ### ####", l: "ko" }, "KR": { n: "South Korea", r: "ASIA_E", p: "+82 10-####-####", l: "ko" },
        "KW": { n: "Kuwait", r: "ME", p: "+965 9### ####", l: "ar" }, "KG": { n: "Kyrgyzstan", r: "EU_C", p: "+996 5## ## ## ##", l: "ru" }, "LA": { n: "Laos", r: "ASIA_E", p: "+856 20 ## ### ###", l: "en" }, "LV": { n: "Latvia", r: "EU_C", p: "+371 2### ####", l: "sv" }, "LB": { n: "Lebanon", r: "ME", p: "+961 7# ### ###", l: "ar" }, "LS": { n: "Lesotho", r: "GENERIC", p: "+266 5### ####", l: "en" },
        "LR": { n: "Liberia", r: "GENERIC", p: "+231 77 ### ####", l: "en" }, "LY": { n: "Libya", r: "ME", p: "+218 9# ### ####", l: "ar" }, "LI": { n: "Liechtenstein", r: "EU_C", p: "+423 7## ####", l: "de" }, "LT": { n: "Lithuania", r: "EU_C", p: "+370 6## #####", l: "sv" }, "LU": { n: "Luxembourg", r: "EU_W", p: "+352 6## ### ###", l: "fr" }, "MG": { n: "Madagascar", r: "GENERIC", p: "+261 3# ## ### ##", l: "fr" },
        "MW": { n: "Malawi", r: "GENERIC", p: "+265 9# ### ####", l: "en" }, "MY": { n: "Malaysia", r: "ASIA_S", p: "+60 1# ### ####", l: "en" }, "MV": { n: "Maldives", r: "ASIA_S", p: "+960 7## ####", l: "en" }, "ML": { n: "Mali", r: "GENERIC", p: "+223 7# ## ## ##", l: "fr" }, "MT": { n: "Malta", r: "EU_S", p: "+356 79## ####", l: "en" }, "MH": { n: "Marshall Islands", r: "US", p: "+692 625 ####", l: "en" },
        "MR": { n: "Mauritania", r: "ME", p: "+222 4### ####", l: "ar" }, "MU": { n: "Mauritius", r: "GENERIC", p: "+230 5### ####", l: "en" }, "MX": { n: "Mexico", r: "LATAM", p: "+52 55 #### ####", l: "es" }, "FM": { n: "Micronesia", r: "US", p: "+691 3## ####", l: "en" }, "MD": { n: "Moldova", r: "EU_C", p: "+373 6## #####", l: "ru" }, "MC": { n: "Monaco", r: "EU_W", p: "+377 6 ## ## ## ##", l: "fr" },
        "MN": { n: "Mongolia", r: "ASIA_E", p: "+976 9### ####", l: "zh" }, "ME": { n: "Montenegro", r: "EU_S", p: "+382 6# ### ###", l: "pl" }, "MA": { n: "Morocco", r: "ME", p: "+212 6## ### ###", l: "fr" }, "MZ": { n: "Mozambique", r: "GENERIC", p: "+258 8# ### ####", l: "pt" }, "MM": { n: "Myanmar", r: "ASIA_E", p: "+95 9 ### ### ###", l: "en" }, "NA": { n: "Namibia", r: "GENERIC", p: "+264 81 ### ####", l: "en" },
        "NR": { n: "Nauru", r: "US", p: "+674 555 ####", l: "en" }, "NP": { n: "Nepal", r: "ASIA_S", p: "+977 98## ######", l: "hi" }, "NL": { n: "Netherlands", r: "EU_C", p: "+31 6 ########", l: "de" }, "NZ": { n: "New Zealand", r: "UK", p: "+64 2# ### ####", l: "en" }, "NI": { n: "Nicaragua", r: "LATAM", p: "+505 8### ####", l: "es" }, "NE": { n: "Niger", r: "GENERIC", p: "+227 9# ## ## ##", l: "fr" },
        "NG": { n: "Nigeria", r: "GENERIC", p: "+234 8## ### ####", l: "en" }, "MK": { n: "North Macedonia", r: "EU_S", p: "+389 7# ### ###", l: "pl" }, "NO": { n: "Norway", r: "EU_C", p: "+47 ### ## ###", l: "sv" },
        "OM": { n: "Oman", r: "ME", p: "+968 9### ####", l: "ar" }, "PK": { n: "Pakistan", r: "ASIA_S", p: "+92 3## #######", l: "ar" }, "PW": { n: "Palau", r: "US", p: "+680 77# ####", l: "en" },
        "PA": { n: "Panama", r: "LATAM", p: "+507 6###-####", l: "es" }, "PG": { n: "Papua New Guinea", r: "US", p: "+675 7### ####", l: "en" }, "PY": { n: "Paraguay", r: "LATAM", p: "+595 9## ### ###", l: "es" },
        "PE": { n: "Peru", r: "LATAM", p: "+51 9## ### ###", l: "es" }, "PH": { n: "Philippines", r: "ASIA_S", p: "+63 9## ### ####", l: "en" }, "PL": { n: "Poland", r: "EU_C", p: "+48 ### ### ###", l: "pl" },
        "PT": { n: "Portugal", r: "EU_S", p: "+351 9# ### ####", l: "pt" }, "QA": { n: "Qatar", r: "ME", p: "+974 3### ####", l: "ar" }, "RO": { n: "Romania", r: "EU_S", p: "+40 7## ### ###", l: "it" },
        "RU": { n: "Russia", r: "EU_C", p: "+7 9## ###-##-##", l: "ru" }, "RW": { n: "Rwanda", r: "GENERIC", p: "+250 78# ### ###", l: "fr" }, "KN": { n: "Saint Kitts & Nevis", r: "US", p: "+1 869-###-####", l: "en" },
        "LC": { n: "Saint Lucia", r: "US", p: "+1 758-###-####", l: "en" }, "VC": { n: "St. Vincent & Grenadines", r: "US", p: "+1 784-###-####", l: "en" }, "WS": { n: "Samoa", r: "US", p: "+685 7# #####", l: "en" },
        "SM": { n: "San Marino", r: "EU_S", p: "+378 66## ####", l: "it" }, "ST": { n: "Sao Tome & Principe", r: "GENERIC", p: "+239 9## ####", l: "pt" }, "SA": { n: "Saudi Arabia", r: "ME", p: "+966 5# ### ####", l: "ar" },
        "SN": { n: "Senegal", r: "GENERIC", p: "+221 7# ### ## ##", l: "fr" }, "RS": { n: "Serbia", r: "EU_S", p: "+381 6# ### ####", l: "pl" }, "SC": { n: "Seychelles", r: "GENERIC", p: "+248 2 ## ## ##", l: "en" },
        "SL": { n: "Sierra Leone", r: "GENERIC", p: "+232 7# ### ###", l: "en" }, "SG": { n: "Singapore", r: "UK", p: "+65 8### ####", l: "zh" }, "SK": { n: "Slovakia", r: "EU_C", p: "+421 9## ### ###", l: "de" },
        "SI": { n: "Slovenia", r: "EU_S", p: "+386 4# ### ###", l: "de" }, "SB": { n: "Solomon Islands", r: "US", p: "+677 7####", l: "en" }, "SO": { n: "Somalia", r: "ME", p: "+252 61 #######", l: "ar" },
        "ZA": { n: "South Africa", r: "UK", p: "+27 8# ### ####", l: "en" }, "SS": { n: "South Sudan", r: "GENERIC", p: "+211 9## ### ###", l: "en" }, "ES": { n: "Spain", r: "EU_S", p: "+34 6## ### ###", l: "es" },
        "LK": { n: "Sri Lanka", r: "ASIA_S", p: "+94 7# ### ####", l: "si" }, "SD": { n: "Sudan", r: "ME", p: "+249 9## ### ###", l: "ar" }, "SR": { n: "Suriname", r: "LATAM", p: "+597 8######", l: "nl" },
        "SE": { n: "Sweden", r: "EU_C", p: "+46 7# ### ####", l: "sv" }, "CH": { n: "Switzerland", r: "EU_C", p: "+41 7# ### ## ##", l: "de" }, "SY": { n: "Syria", r: "ME", p: "+963 9## ### ###", l: "ar" },
        "TJ": { n: "Tajikistan", r: "EU_C", p: "+992 9# ### ####", l: "ru" }, "TZ": { n: "Tanzania", r: "GENERIC", p: "+255 7## ### ###", l: "en" }, "TH": { n: "Thailand", r: "ASIA_S", p: "+66 8# ### ####", l: "en" },
        "TL": { n: "Timor-Leste", r: "ASIA_E", p: "+670 77## ####", l: "pt" }, "TG": { n: "Togo", r: "GENERIC", p: "+228 9# ## ## ##", l: "fr" }, "TO": { n: "Tonga", r: "US", p: "+676 7####", l: "en" },
        "TT": { n: "Trinidad & Tobago", r: "US", p: "+1 868-###-####", l: "en" }, "TN": { n: "Tunisia", r: "ME", p: "+216 2# ### ###", l: "ar" }, "TR": { n: "Turkey", r: "ME", p: "+90 5## ### ## ##", l: "tr" },
        "TM": { n: "Turkmenistan", r: "EU_C", p: "+993 6# ######", l: "ru" }, "TV": { n: "Tuvalu", r: "US", p: "+688 90####", l: "en" }, "UG": { n: "Uganda", r: "GENERIC", p: "+256 7## ### ###", l: "en" },
        "UA": { n: "Ukraine", r: "EU_C", p: "+380 ## ### ####", l: "ru" }, "AE": { n: "UAE", r: "ME", p: "+971 5# ### ####", l: "ar" }, "GB": { n: "United Kingdom", r: "UK", p: "+44 7### ######", l: "en" },
        "US": { n: "United States", r: "US", p: "+1 ###-###-####", l: "en" }, "UY": { n: "Uruguay", r: "LATAM", p: "+598 9# ### ###", l: "es" }, "UZ": { n: "Uzbekistan", r: "EU_C", p: "+998 9# ### ## ##", l: "ru" },
        "VU": { n: "Vanuatu", r: "US", p: "+678 7## ####", l: "en" }, "VA": { n: "Vatican City", r: "EU_S", p: "+39 06 698 #####", l: "it" }, "VE": { n: "Venezuela", r: "LATAM", p: "+58 4## ### ####", l: "es" },
        "VN": { n: "Vietnam", r: "ASIA_E", p: "+84 9# ### ####", l: "zh" }, "YE": { n: "Yemen", r: "ME", p: "+967 7## ### ###", l: "ar" }, "ZM": { n: "Zambia", r: "GENERIC", p: "+260 9# ### ####", l: "en" },
        "ZW": { n: "Zimbabwe", r: "GENERIC", p: "+263 7# ### ####", l: "en" }
    };

    /* =========================================================================
       §5 — HELPER UTILITIES
    ========================================================================= */

    /**
     * getRandom
     * Returns a single uniformly-random element from the supplied array.
     * Safely returns "Unknown" if the array is empty or undefined.
     *
     * @param  {Array} arr  Source array to pick from.
     * @returns {*}         A random element, or "Unknown" on failure.
     */
    const getRandom = (arr) => (arr && arr.length) ? arr[Math.floor(Math.random() * arr.length)] : "Unknown";

    /**
     * generateNumber
     * Replaces every '#' character in a phone-pattern mask with a random
     * decimal digit (0–9), producing a formatted phone number string.
     *
     * Example: "+1 ###-###-####" → "+1 472-381-9054"
     *
     * @param  {string} mask  Phone pattern containing '#' placeholders.
     * @returns {string}      Formatted phone number with digits substituted.
     */
    const generateNumber = (mask) => mask.replace(/#/g, () => Math.floor(Math.random() * 10));

    /**
     * generateDateOfBirth
     * Produces a random ISO-8601 date string (YYYY-MM-DD) representing a
     * birth date between 1 January 1970 and 1 January 2005 — covering a
     * realistic adult-age range for QA identity generation.
     *
     * @returns {string}  Date in "YYYY-MM-DD" format.
     */
    const generateDateOfBirth = () => {
        const start = new Date(1970, 0, 1).getTime();
        const end   = new Date(2005, 0, 1).getTime();
        return new Date(start + Math.random() * (end - start)).toISOString().split('T')[0];
    };

    /**
     * generatePassword
     * Builds a cryptographically-style 16-character password drawn from a
     * mixed-case alphanumeric + special-character pool.
     * Note: Uses Math.random() (PRNG) — adequate for QA test data, not for
     * production security purposes.
     *
     * @returns {string}  A 16-character pseudo-random password string.
     */
    const generatePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
        return Array(16).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
    };

    /**
     * generateLuhnCard
     * Produces a 16-digit payment card number that passes the ISO/IEC 7812
     * Luhn (Mod-10) checksum algorithm.
     *
     * Algorithm steps:
     *   1. Start with a card-brand prefix ("4" → Visa-style, "5" → MC-style).
     *   2. Append 14 random digits to make a 15-digit partial number.
     *   3. Compute the Luhn check digit over those 15 digits:
     *      a. Reverse the digit array.
     *      b. Double every digit at an even index (0-based from the right).
     *      c. Subtract 9 from any doubled value > 9.
     *      d. Sum all resulting digits.
     *      e. checkDigit = (10 − (sum % 10)) % 10
     *   4. Append the check digit → 16-digit total.
     *   5. Format as "XXXX XXXX XXXX XXXX" for readability.
     *
     * ⚠️  These numbers are MATHEMATICALLY valid but FUNCTIONALLY fictitious.
     *     They cannot process real transactions.
     *
     * @returns {string}  Luhn-valid 16-digit card number with space separators.
     */
    const generateLuhnCard = () => {
        /* Step 1 — choose a card-brand prefix */
        const prefix = Math.random() > 0.5 ? "4" : "5";
        let digits   = prefix.split('').map(Number);

        /* Step 2 — fill to 15 digits */
        while (digits.length < 15) {
            digits.push(Math.floor(Math.random() * 10));
        }

        /* Step 3 — calculate the Luhn check digit */
        let sum      = 0;
        let reversed = [...digits].reverse();

        for (let i = 0; i < reversed.length; i++) {
            let digit = reversed[i];
            if (i % 2 === 0) {          /* double every second digit from the right */
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
        }

        const checkDigit = (10 - (sum % 10)) % 10;
        digits.push(checkDigit);

        /* Step 5 — format as XXXX XXXX XXXX XXXX */
        return digits.join('').replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    };

    /* =========================================================================
       §6 — CORE LOGIC FUNCTIONS
    ========================================================================= */

    /**
     * populateDropdown
     * Reads all entries from worldDB, sorts them alphabetically by country
     * name, then appends an <option> element for each country to the
     * #countrySelect <select> element using a DocumentFragment for efficient
     * batch DOM insertion.
     * Defaults the selection to "US" (United States) after population.
     *
     * Called once during init().
     */
    const populateDropdown = () => {
        const select = document.getElementById('countrySelect');
        if (!select) return;

        /* Build a sorted array of { code, name } objects */
        const sortedCountries = Object.keys(worldDB)
            .map(key => ({ code: key, name: worldDB[key].n }))
            .sort((a, b) => a.name.localeCompare(b.name));

        /* Append options via a DocumentFragment to minimise reflows */
        const fragment = document.createDocumentFragment();
        sortedCountries.forEach(obj => {
            const option       = document.createElement("option");
            option.value       = obj.code;
            option.textContent = obj.name;
            fragment.appendChild(option);
        });

        select.appendChild(fragment);
        select.value = "US"; /* default selection */
    };

    /**
     * updateUI
     * Stores the newly generated data object in currentState, then iterates
     * over each key and updates the corresponding DOM element (id="val-{key}").
     * A CSS class "refreshing" is added after a forced reflow (void offsetWidth)
     * to retrigger the card-pop keyframe animation defined in tools-template.css,
     * providing a smooth data-refresh visual cue to the user.
     *
     * @param {Object} data  The complete identity object produced by generateIdentity().
     */
    const updateUI = (data) => {
        /* Persist generated data for JSON export and clipboard copy */
        currentState = data;

        /* Update each card's value element with the new data */
        Object.keys(data).forEach(key => {
            const el = document.getElementById(`val-${key}`);
            if (el) {
                /* Remove the class first, force reflow, then re-add it
                   so the CSS animation restarts from its 0% keyframe. */
                el.parentElement.classList.remove('refreshing');
                void el.parentElement.offsetWidth; /* trigger reflow */
                el.innerText = data[key];
                el.parentElement.classList.add('refreshing');
            }
        });
    };

    /**
     * generateIdentity
     * The main data-generation function.  Reads the currently selected country
     * code, looks up the matching locale and region from worldDB, then assembles
     * a complete synthetic identity object with 16 fields:
     *
     *   Personal  : fullName, gender, dob, blood
     *   Digital   : username, password, email, phone
     *   Payment   : creditCard (Luhn-valid), ccExpiry, ccCvv
     *   Address   : street, city, state, zip, country
     *
     * After construction the object is passed to updateUI() for DOM rendering.
     */
    const generateIdentity = () => {
        /* ── Resolve country & locale data ── */
        const select      = document.getElementById('countrySelect');
        const countryCode = select ? select.value : "US";
        const db          = worldDB[countryCode] || worldDB["US"];

        /* ── Name generation — locale-aware ── */
        const langKey = (db.l in nameData) ? db.l : "en";
        const fName   = getRandom(nameData[langKey].f);
        const lName   = getRandom(nameData[langKey].l);

        /* ── Digital profile derivation ── */
        /* Strip non-ASCII characters for the username to ensure URL-safety */
        const cleanF   = fName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const cleanL   = lName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const username = `${cleanF}.${cleanL}${Math.floor(Math.random() * 99)}`;

        /* ── Address / location data ── */
        const regionKey = (db.r in regionData) ? db.r : "GENERIC";
        const region    = regionData[regionKey];
        const cityObj   = getRandom(region.c);
        const address   = `${Math.floor(Math.random() * 999) + 1} ${getRandom(region.s)}`;

        /* ── Assemble the identity object ── */
        const newData = {
            fullName   : `${fName} ${lName}`,
            gender     : Math.random() > 0.5 ? "Male" : "Female",
            dob        : generateDateOfBirth(),
            blood      : getRandom(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]),
            username   : username,
            password   : generatePassword(),
            email      : `${username}@example.com`,
            phone      : generateNumber(db.p),
            creditCard : generateLuhnCard(),
            /* Expiry: random month (MM) + a future year 1–5 years ahead */
            ccExpiry   : `${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}/${String(new Date().getFullYear() + Math.floor(Math.random() * 5) + 1).slice(-2)}`,
            ccCvv      : String(Math.floor(Math.random() * 899) + 100),
            street     : address,
            city       : cityObj.c,
            state      : cityObj.s,
            zip        : cityObj.z,
            country    : db.n
        };

        /* Render all fields to the DOM */
        updateUI(newData);
    };

    /**
     * copyToClipboard
     * Called by the onclick handler on each .qms-data-card element.
     * Reads the data-key attribute of the clicked card, looks up its
     * value in currentState, and writes it to the system clipboard via the
     * Clipboard API (async, Promise-based).
     *
     * On success:
     *   • Adds .copied to the card for the green-flash CSS animation (1.5 s).
     *   • Calls window.showToast() (global toast system) to confirm the action.
     *
     * On failure:
     *   • Logs the error to the console without disturbing the UI.
     *
     * @param {HTMLElement} cardElement  The .qms-data-card that was clicked.
     */
    const copyToClipboard = (cardElement) => {
        const key = cardElement.getAttribute('data-key');

        /* Guard: do nothing if no data has been generated yet */
        if (!currentState[key]) return;

        navigator.clipboard.writeText(currentState[key]).then(() => {
            /* Visual feedback — green border flash on the card */
            cardElement.classList.add('copied');
            setTimeout(() => cardElement.classList.remove('copied'), 1500);

            /* Global toast notification — confirms the copy action */
            window.showToast("Copied to clipboard!");

        }).catch(err => {
            /* Non-critical failure — log only, do not break the UI */
            console.error('MockStudio: clipboard write failed —', err);
        });
    };

    /**
     * downloadJSON
     * Serialises currentState to a formatted JSON string, wraps it in a
     * Blob, creates a temporary object URL, and programmatically triggers a
     * file download named "mock_identity_{timestamp}.json".
     *
     * Guards:
     *   • If no data has been generated (currentState is empty), shows an
     *     error toast via the global window.showToast() system instead of
     *     downloading an empty file.
     *
     * Memory management:
     *   • The temporary <a> element is appended, clicked, and immediately
     *     removed from the DOM.
     *   • URL.revokeObjectURL() is called after the click to release the
     *     Blob memory reference.
     */
    const downloadJSON = () => {
        if (Object.keys(currentState).length === 0) {
            /* Inform the user they must generate data before exporting */
            window.showToast("Please generate data first.", true);
            return;
        }

        /* Serialise with 4-space indentation for human readability */
        const blob = new Blob(
            [JSON.stringify(currentState, null, 4)],
            { type: "application/json" }
        );

        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `mock_identity_${Date.now()}.json`;

        /* Temporarily attach to DOM to trigger the native download dialog */
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        /* Release the object URL to free memory */
        URL.revokeObjectURL(url);
    };

    /* =========================================================================
       §7 — INITIALISATION
    ========================================================================= */

    /**
     * init
     * Entry point for the MockStudio module.  Called once after the DOM has
     * fully loaded (see DOMContentLoaded listener at the bottom of this file).
     *
     * Responsibilities:
     *   1. Populate the #countrySelect dropdown with all 195 country options.
     *   2. Generate an initial identity immediately so the tool is not empty
     *      on first load.
     *   3. Attach click event listeners to #btnGenerate and #btnJson.
     */
    const init = () => {
        /* Step 1 — populate country dropdown */
        populateDropdown();

        /* Step 2 — pre-generate an identity on page load */
        generateIdentity();

        /* Step 3 — bind action button listeners */
        document.getElementById('btnGenerate').addEventListener('click', generateIdentity);
        document.getElementById('btnJson').addEventListener('click', downloadJSON);
    };

    /* =========================================================================
       §8 — PUBLIC API
       Only init() and copy() are exposed outside the IIFE.  All other
       functions remain private to the module closure.
    ========================================================================= */
    return {
        init : init,
        copy : copyToClipboard
    };

})();

/* =============================================================================
   BOOTSTRAP — start the engine once the DOM is fully parsed.
   Using DOMContentLoaded instead of window.onload ensures the script runs as
   soon as the HTML tree is ready, without waiting for images or stylesheets.
============================================================================= */
document.addEventListener('DOMContentLoaded', MockStudio.init);
