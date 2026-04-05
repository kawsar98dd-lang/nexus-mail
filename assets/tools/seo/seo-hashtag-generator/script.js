/**
 * =============================================================================
 *  UltraTag AI Elite — script.js
 *  Viral Keyword & Hashtag Generator for YouTube, Instagram, TikTok & Facebook
 * =============================================================================
 *  Version   : 2.6 (Elite — CodeCanyon Release Build)
 *  Author    : Trusted Tools Web Team
 *  License   : CodeCanyon / Proprietary
 *
 *  Architecture:
 *  ─────────────────────────────────────────────────────────────────────────
 *  The entire tool is encapsulated inside the `UltraTag` object literal to
 *  prevent global namespace pollution. Public methods are explicitly exported
 *  to `window.*` at the bottom to allow HTML inline onClick handlers to work.
 *
 *  Key Systems:
 *  ─────────────────────────────────────────────────────────────────────────
 *  1. Knowledge Base      — 30+ keyword categories with semantic associations.
 *  2. Bangla Mode         — Localized Bangla script tag injection.
 *  3. Canvas Visual Engine— Hardware-accelerated particle network background.
 *  4. Clipboard System    — Robust mobile/desktop copy (async + execCommand fallback).
 *  5. History System      — LocalStorage-based recent search management (max 5).
 *  6. Theme Engine        — Persists dark/light preference via localStorage.
 *  7. Global Toast        — Delegates all notifications to window.showToast()
 *                           (injected by global.js — do NOT redeclare here).
 * =============================================================================
 */

const UltraTag = {

    // =========================================================================
    // [SECTION 1: CONFIGURATION STATE]
    // Core runtime state variables for the tool.
    // These are read and mutated by multiple functions throughout the object.
    // =========================================================================

    /** @type {string} The currently active social platform. */
    currentPlatform : 'youtube',

    /**
     * @type {boolean} Whether tags should be formatted with commas.
     * Only relevant for YouTube (comma-separated tags in YT Studio).
     */
    useCommas : true,

    /**
     * @type {{viral: boolean, niche: boolean, bangla: boolean}}
     * Tracks the ON/OFF state of each filter chip.
     * "viral" is true by default to match the .checked state in HTML.
     */
    activeFilters : { viral: true, niche: false, bangla: false },

    /** @type {Array<{text: string, comp: string}>} The current list of generated tags. */
    currentTags : [],

    /** @type {number} Maximum number of tags to generate per request. */
    maxTags : 50,


    // =========================================================================
    // [SECTION 2: KNOWLEDGE BASE — DO NOT MODIFY]
    // Weighted semantic keyword database.
    // Each key maps to an array of contextually related tags. The algorithm
    // performs a substring match between the user's input and these keys.
    // =========================================================================
    knowledgeBase: {
        'game': [
            'Gaming', 'Gameplay', 'Streamer', 'Live', 'Walkthrough', 'Gamer', 'Esports', 'NoobVsPro', 'PlayStation', 'Xbox', 'Nintendo', 'PCGaming', 'MobileGaming', 'Console', 'GamingSetup', 'RTX', 'FPS', 'RPG', 'BattleRoyale', 'Speedrun', 'Glitch', 'EasterEgg', 'GameReview', 'Top10Games', 'Highlights', 'Clutch', 'ProPlayer', 'GamingCommunity', 'OnlineGaming', 'Multiplayer', 'CoOp', 'OpenWorld', 'SurvivalGame', 'HorrorGame', 'IndieGame', 'RetroGaming', 'Emulator', 'GamingNews', 'GameDev', 'LevelUp', 'BossFight', 'GamePhysics', 'FunnyMoments', 'RageQuit', 'Troll', 'Hacker', 'Cheater', 'Banned', 'CloudGaming', 'SteamDeck', 'NextGenConsole', 'GamePass', 'GamingChair', 'KeyboardASMR', 'Discord', 'Twitch', 'Streaming', 'LetsPlay', 'GameGuide', 'TipsAndTricks', 'SecretLevel', 'Modding', 'SpeedrunWorldRecord', 'GamingMemes', 'VideoGames', 'GamerLife', 'GamingTikTok', 'HardcoreGaming', 'CasualGamer', 'Ranked', 'Competitive', 'Controller', 'MouseAndKeyboard', '120FPS', '4KGaming', 'HDR', 'RayTracing', 'UnrealEngine', 'Unity3D', 'BetaTest', 'EarlyAccess', 'DLC', 'ExpansionPack', 'SeasonPass', 'BattlePass', 'LootBox', 'SkinShowcase', 'CharacterBuild', 'BestGames2026', 'VirtualReality', 'OculusQuest3', 'GamingLaptop', 'FreeGames', 'GameTheory', 'SpatialGaming', 'MetaverseGames'
        ],
        'minecraft': [
            'Minecraft', 'MinecraftSurvival', 'MinecraftBuilds', 'MinecraftMods', 'Minecrafter', 'Bedwars', 'Skyblock', 'Herobrine', 'Dream', 'Technoblade', 'MinecraftPVP', 'Redstone', 'MinecraftUpdate', 'Minecraft100Days', 'MinecraftHardcore', 'Shaders', 'TexturePack', 'MinecraftServer', 'Hermitcraft', 'Speedbuilder', 'MinecraftManhunt', 'PixelArt', 'MinecraftHouse', 'MinecraftTutorial', 'Optifine', 'Fabric', 'Forge', 'SMP', 'LifestealSMP', 'MinecraftLore', 'JennyMod', 'MinecraftPe', 'MCPE', 'MinecraftJava', 'MinecraftBedrock', 'Hypixel', 'CubeCraft', 'Mineplex', 'BuildingHacks', 'RedstoneBuilds', 'MinecraftFarm', 'VillagerTrading', 'NetherUpdate', 'EndUpdate', 'Warden', 'EnderDragon', 'WitherBoss', 'MinecraftSpeedrun', 'DreamSMP', 'TommyInnit', 'GeorgeNotFound', 'Sapnap', 'Philza', 'Ranboo', 'Tubbo', 'MinecraftChallenge', 'NoobVsProVsHacker', 'MinecraftAnimation', 'MinecraftShorts', 'BlockGame', 'Crafting', 'Mining', 'Diamonds', 'Netherite', 'Elytra', 'Parkour', 'MapReview', 'Minecraft1.22', 'MinecraftLegends', 'MinecraftDungeons', 'MinecraftLive', 'MobVote', 'Sniffer', 'TrailRuins', 'ArmorTrim'
        ],
        'roblox': [
            'Roblox', 'RobloxEdits', 'Bloxburg', 'AdoptMe', 'RobloxTrend', 'RobloxOutfit', 'RobloxDev', 'Brookhaven', 'RobloxFunny', 'TowerOfHell', 'PetSimulatorX', 'BedWarsRoblox', 'Piggy', 'RobloxAnimation', 'Robux', 'FreeRobux', 'RobloxGiveaway', 'DaHood', 'MurderMystery2', 'RoyaleHigh', 'MeepCity', 'Jailbreak', 'RobloxStory', 'BloxFruits', 'DoorsRoblox', 'RainbowFriends', 'RobloxStudio', 'Obby', 'Tycoon', 'Simulator', 'RobloxRoleplay', 'RobloxAvatar', 'RobloxHacks', 'RobloxGlitch', 'RobloxCodes', 'PromoCodes', 'StarCode', 'RobloxYoutuber', 'RobloxTikTok', 'RobloxMemes', 'AnimeAdventures', 'KingLegacy', 'GPO', 'GrandPieceOnline', 'ShindoLife', 'BloxFruitsCodes', 'RobloxUpdate', 'VoiceChat', 'RobloxVR', 'RobloxHorror', 'TheMimic', 'Apeirophobia', 'RobloxParkour', 'SlapBattles', 'BladeBall', 'RobloxVoiceChat', 'RobloxEvents', 'UGC', 'RobloxTrading'
        ],
        'fps': [
            'PubgMobile', 'FreeFire', 'CallOfDuty', 'COD', 'Warzone', 'Valorant', 'CSGO', 'ApexLegends', 'Overwatch', 'Fortnite', 'Sniper', 'Headshot', 'RankPush', 'BattlePass', 'AimBot', 'WallHack', 'NoRecoil', 'SensitivitySettings', 'BestLoadout', 'KillMontage', 'SquadWipe', 'SoloVsSquad', 'RushGameplay', 'Camper', 'TDM', 'SearchAndDestroy', 'CounterStrike2', 'TacticalShooter', 'Farlight84', 'RainbowSixSiege', 'EscapeFromTarkov', 'Rust', 'DayZ', 'Battlefield', 'HaloInfinite', 'Destiny2', 'TeamDeathmatch', 'ClutchGod', 'Ace', 'PistolRound', 'KnifeKill', 'GrenadeLineup', 'MapKnowledge', 'CrosshairPlacement', 'AimTraining', 'AimLab', 'Kovaaks', 'EsportsTournament', 'Major', 'ProSettings', 'Config', 'FpsBoost', 'LagFix', 'PingTest', 'Peek', 'JigglePeek', 'BunnyHop', 'Strafe', 'FreeFireMax', 'BGMI', 'WarzoneMobile', 'ValorantMobile', 'CS2', 'ValorantLineups'
        ],
        'gta': [
            'GTA5', 'GTAV', 'GrandTheftAuto', 'GTARoleplay', 'FiveM', 'CJ', 'LosSantos', 'RockstarGames', 'GTA6', 'GtaOnline', 'FunnyMoments', 'ThugLife', 'GtaMods', 'GtaVStunts', 'Franklin', 'Trevor', 'Michael', 'LSPDFR', 'GtaMystery', 'GtaSanAndreas', 'ViceCity', 'LibertyCity', 'Heist', 'MoneyGlitch', 'GtaLeaks', 'Gta6News', 'RoleplayServer', 'NoPixel', 'GangWar', 'PoliceChase', 'ModMenu', 'GtaGraphicsMod', 'RealLifeMod', 'ZombieMod', 'SuperheroMod', 'GtaVSecrets', 'MountChiliad', 'JetStunt', 'Race', 'Parkour', 'CayoPerico', 'DiamondCasino', 'GtaOnlineUpdate', 'WeeklyUpdate', 'PodiumVehicle', 'GtaVOnlineSolo', 'GtaRpMoments', 'FailRp', 'WinRp', 'LuciaAndJason', 'ViceCityMap', 'GTA6Trailer', 'GTA6Gameplay', 'RedDeadRedemption2'
        ],
        'moba': [
            'LeagueOfLegends', 'LoL', 'Dota2', 'MobileLegends', 'MLBB', 'WildRift', 'PokemonUnite', 'ArenaOfValor', 'Faker', 'Worlds2026', 'RankedMatch', 'SupportMain', 'Carry', 'Jungler', 'Gank', 'PentaKill', 'MobaGameplay', 'BuildGuide', 'MetaHero', 'EsportsLife', 'TeamfightTactics', 'TFT', 'AutoChess', 'SkinSpotlight', 'ChampionGuide', 'PatchNotes', 'Nerf', 'Buff', 'RiotGames', 'Valve', 'TheInternational', 'LCK', 'LPL', 'LEC', 'LCS', 'M6WorldChampionship', 'Maniac', 'Savage', 'Mythic', 'Glory', 'Immortal', 'TopLane', 'MidLane', 'BotLane', 'Roamer', 'HonorOfKings', 'BrawlStars'
        ],
        'genshin': [
            'GenshinImpact', 'Hoyoverse', 'Primogems', 'Gacha', 'Wish', 'SpiralAbyss', 'Paimon', 'Zhongli', 'RaidenShogun', 'AnimeGame', 'HonkaiStarRail', 'TowerOfFantasy', 'Waifu', 'Cosplay', 'Lore', 'BuildGuide', 'F2P', 'Whale', 'Artifacts', 'Teyvat', 'Fontaine', 'Natlan', 'Snezhnaya', 'ArchonQuest', 'StoryQuest', 'HangoutEvent', 'GenshinLeaks', 'Banner', 'Reroll', 'Showcase', 'DamageTest', 'OneShot', 'Speedrun', 'CoOpMode', 'Teapot', 'TCG', 'GeniusInvokation', 'ZenlessZoneZero', 'WutheringWaves', 'PunishingGrayRaven', 'GachaHell', 'CharacterDemo'
        ],
        'horror': [
            'HorrorGames', 'Scary', 'Jumpscare', 'ResidentEvil', 'SilentHill', 'Outlast', 'Phasmophobia', 'PoppyPlaytime', 'FNAF', 'FiveNightsAtFreddys', 'Amnesia', 'DeadByDaylight', 'Granny', 'EvilNun', 'PsychologicalHorror', 'IndieHorror', 'Creepypasta', 'DarkWebGames', 'SirenHead', 'Backrooms', 'SCP', 'Slenderman', 'HorrorStory', 'Nightmare', 'Ghost', 'Paranormal', 'Demon', 'Exorcism', 'HauntedHouse', 'EscapeRoom', 'PuzzleGame', 'SurvivalHorror', 'PoppyPlaytimeChapter3', 'CatNap', 'SmilingCritters', 'FNAFSecurityBreach', 'FNAFMovie', 'ChooChooCharles', 'GartenOfBanban'
        ],
        'tech': [
            'Technology', 'Review', 'Unboxing', 'Gadgets', 'Innovation', 'TechTips', 'Software', 'Hardware', 'FutureTech', 'Electronics', 'TechNews', 'SmartHome', 'IoT', 'Wearables', 'VR', 'AR', 'Metaverse', 'Robotics', 'Drone', '3DPrinting', 'SetupWars', 'DeskSetup', 'CleanSetup', 'RGB', 'CableManagement', 'TechLife', 'Engineering', 'ScienceTech', 'BestTech2026', 'CoolGadgets', 'TechYouTuber', 'MKBHD', 'MrWhoseTheBoss', 'LinusTechTips', 'Dave2D', 'UnboxTherapy', 'TechBurner', 'GyanTherapy', 'TrakinTech', 'TechnicalGuruji', 'GadgetReview', 'Comparison', 'Versus', 'Teardown', 'DurabilityTest', 'DropTest', 'WaterTest', 'Specs', 'Features', 'Price', 'ReleaseDate', 'Rumors', 'Leaks', 'Concept', 'AppleVisionPro', 'MixedReality', 'WiFi7', 'Bluetooth6', 'TypeC', 'Thunderbolt5', 'SpatialComputing', 'AIHardware', 'Neuralink'
        ],
        'ai': [
            'ArtificialIntelligence', 'AI', 'ChatGPT', 'OpenAI', 'Midjourney', 'StableDiffusion', 'MachineLearning', 'DeepLearning', 'NeuralNetworks', 'Robotics', 'Automation', 'GenerativeAI', 'Bard', 'GoogleGemini', 'Copilot', 'PythonAI', 'DataScience', 'BigData', 'PromptEngineering', 'FutureOfWork', 'AIArt', 'TechRevolution', 'DeepFake', 'VoiceAI', 'Chatbot', 'LLM', 'NvidiaAI', 'AutoGPT', 'LangChain', 'HuggingFace', 'TensorFlow', 'PyTorch', 'ComputerVision', 'NLP', 'NaturalLanguageProcessing', 'AIUpdates', 'AITools', 'FreeAI', 'BestAITools', 'AIWebsite', 'TextToImage', 'TextToVideo', 'AIAvatar', 'VirtualAssistant', 'Siri', 'Alexa', 'GoogleAssistant', 'ElonMusk', 'SamAltman', 'AGI', 'Sora', 'GPT5', 'GeminiUltra', 'Claude3', 'PerplexityAI', 'AIProgramming', 'AIJob', 'AIAgent', 'AutonomousAI'
        ],
        'mobile': [
            'Smartphone', 'Android', 'iOS', 'iPhone', 'Samsung', 'Pixel', 'Xiaomi', 'OnePlus', 'Realme', 'Infinix', 'CameraTest', 'BatteryTest', 'SpeedTest', 'Flagship', 'BudgetPhone', 'GamingPhone', 'MobilePhotography', 'TipsAndTricks', 'HiddenFeatures', 'Update', 'Jailbreak', 'Root', 'CustomROM', 'APK', 'AppReview', 'BestApps', 'iOS18', 'Android16', 'FoldablePhone', 'NothingPhone', 'FlipPhone', 'CurvedDisplay', 'Amoled', 'Snapdragon', 'MediaTek', 'Exynos', 'BionicChip', 'FastCharging', 'WirelessCharging', '5G', 'eSIM', 'MobileData', 'WiFi6', 'Bluetooth', 'Accessories', 'PhoneCase', 'ScreenProtector', 'PowerBank', 'Gimbal', 'MobileEditing', 'CapCut', 'LightroomMobile', 'VNEditor', 'iPhone17', 'SamsungS26', 'OneUI', 'HyperOS', 'OxygenOS'
        ],
        'computer': [
            'PCBuild', 'GamingPC', 'Laptop', 'MacBook', 'Windows12', 'Linux', 'GPU', 'CPU', 'Nvidia', 'AMD', 'Intel', 'MechanicalKeyboard', 'Mouse', 'Monitor', 'ComputerScience', 'CyberSecurity', 'Hacking', 'EthicalHacking', 'KaliLinux', 'Programming', 'Server', 'CloudComputing', 'AWS', 'Azure', 'Overclocking', 'WaterCooling', 'PCMasterRace', 'TechSupport', 'Troubleshooting', 'VirusRemoval', 'Antivirus', 'VPN', 'InternetSpeed', 'Router', 'Modem', 'SSD', 'HDD', 'RAM', 'Motherboard', 'PSU', 'Cabinet', 'ThermalPaste', 'CableManagement', 'DualMonitor', 'Ultrawide', '4KMonitor', 'RefreshRate', 'FPSBoost', 'LagFix', 'WindowsTips', 'MacTips', 'Shortcuts', 'ProductivityHacks', 'RTX5090', 'DDR6', 'OLEDMonitor', 'CustomKeyboard', 'QuantumComputing'
        ],
        'saas': [
            'SaaS', 'SoftwareAsAService', 'CloudSoftware', 'CRM', 'ERP', 'ProjectManagement', 'Slack', 'Notion', 'Trello', 'Asana', 'Zoom', 'MicrosoftTeams', 'GoogleWorkspace', 'ProductivityTools', 'AutomationTools', 'Zapier', 'NoCode', 'LowCode', 'WebFlow', 'Bubble', 'Airtable', 'ClickUp', 'MondayDotCom', 'Salesforce', 'HubSpot', 'Shopify', 'Wix', 'WordPress', 'Squarespace', 'Framer', 'Canva', 'AdobeCreativeCloud', 'Figma', 'Sketch', 'InVision', 'Miro', 'Loom', 'Obsidian', 'Evernote', 'MicroSaaS', 'IndieHacker', 'BuildInPublic', 'SaaSSales', 'B2B', 'B2C', 'StartupIdeas', 'Bootstrapping', 'ProductHunt', 'AppSumo', 'LifetimeDeal', 'RemoteWorkTools', 'DigitalTransformation', 'TechStack', 'APIIntegration', 'WhiteLabel'
        ],
        'money': [
            'Finance', 'Money', 'Investing', 'StockMarket', 'Trading', 'Forex', 'PassiveIncome', 'SideHustle', 'MakeMoneyOnline', 'OnlineBusiness', 'Entrepreneur', 'Business', 'Startup', 'Economics', 'Wealth', 'Millionaire', 'FinancialFreedom', 'Budgeting', 'SavingMoney', 'CreditCard', 'Insurance', 'Loans', 'Mortgage', 'RealEstate', 'Dropshipping', 'AmazonFBA', 'AffiliateMarketing', 'DigitalProducts', 'Ebook', 'CourseSelling', 'PrintOnDemand', 'Shopify', 'Ecom', 'HighTicketClosing', 'Sales', 'Marketing', 'Branding', 'PersonalBrand', 'RichDadPoorDad', 'WarrenBuffett', 'ElonMuskMotivation', 'SuccessMindset', 'CompoundInterest', 'Dividends', 'ETF', 'MutualFunds', 'IndexFunds', 'S&P500', 'WallStreet', 'Recession', 'Inflation', 'Taxes', 'TaxSaving', 'CreditScore', 'Fintech', 'Neobank', 'DigitalCurrency', 'Cashless', 'InvestmentTips', 'MoneyManagement', 'RetirementPlanning', '401k', 'RothIRA', 'DayTrading', 'SwingTrading', 'OptionTrading', 'CryptoTrading', 'ForexSignals', 'BusinessStrategy', 'MarketingStrategy'
        ],
        'crypto': [
            'Crypto', 'Bitcoin', 'Ethereum', 'Blockchain', 'NFT', 'Web3', 'DeFi', 'Altcoins', 'Binance', 'Coinbase', 'TradingView', 'BullRun', 'BearMarket', 'CryptoNews', 'Mining', 'Airdrop', 'MetaMask', 'ShibaInu', 'Dogecoin', 'XRP', 'Solana', 'Cardano', 'CryptoTrading', 'TechnicalAnalysis', 'Hodl', 'ToTheMoon', 'SmartContracts', 'DAO', 'Ledger', 'Trezor', 'ColdWallet', 'HotWallet', 'GasFees', 'P2P', 'Staking', 'YieldFarming', 'LiquidityPool', 'Whitepaper', 'ICO', 'IDO', 'Launchpad', 'Memecoin', 'Pepe', 'Floki', 'SafeMoon', 'CryptoRegulation', 'SEC', 'BitcoinHalving', 'Layer2', 'Polygon', 'Arbitrum', 'Optimism', 'ZKRollup', 'MetaverseToken', 'GameFi', 'PlayToEarn', 'CryptoWallet', 'SeedPhrase', 'CentralizedExchange', 'DEX', 'Uniswap', 'PancakeSwap'
        ],
        'freelance': [
            'Freelancing', 'Upwork', 'Fiverr', 'Freelancer', 'WorkFromHome', 'RemoteJob', 'DigitalNomad', 'Copywriting', 'DataEntry', 'VirtualAssistant', 'GigEconomy', 'OnlineJobs', 'ContentWriting', 'Translation', 'VideoEditingJob', 'GraphicDesignJob', 'WebDevJob', 'Portfolio', 'ClientHunting', 'ColdEmail', 'LinkedInGrowth', 'ResumeTips', 'InterviewHacks', 'SalaryNegotiation', 'PaymentGateway', 'PayPal', 'Payoneer', 'Wise', 'FreelanceTips', 'SuccessStory', 'CaseStudy', 'SkillDevelopment', 'TimeManagement', 'Ghostwriting', 'SEOWriting', 'PromptEngineeringJob', 'AITraining', 'UserTesting', 'Transcription', 'VoiceOverArtist', 'SocialMediaManager', 'CommunityManager', 'RemoteLife', 'WorkLifeBalance', 'FreelanceRate', 'Contract', 'ProposalWriting'
        ],
        'high_cpc': [
            'Insurance', 'Loans', 'Mortgage', 'Attorney', 'Credit', 'Lawyer', 'Donate', 'Degree', 'Hosting', 'Claim', 'Conference', 'CallCenter', 'Trading', 'Software', 'Recovery', 'Transfer', 'GasElectricity', 'Classes', 'Rehab', 'Treatment', 'CordBlood', 'Mesothelioma', 'StructuredSettlement', 'CarAccident', 'PersonalInjury', 'Refinance', 'LifeInsurance', 'HealthInsurance', 'CarInsurance', 'HomeInsurance', 'BusinessInsurance', 'TravelInsurance', 'OnlineDegree', 'MBA', 'PhD', 'WebHosting', 'DedicatedServer', 'VPNDeal', 'CloudStorage', 'AntivirusSoftware', 'CRMSoftware', 'EmailMarketing', 'SEOToos', 'CreditRepair', 'DebtConsolidation', 'StudentLoans', 'ForexTrading', 'DUI', 'Malpractice', 'RealEstateAgent', 'DigitalMarketingAgency', 'CyberSecurityCourse', 'DataRecovery'
        ],
        'vlog': [
            'Vlog', 'DailyVlog', 'LifeStyle', 'MyDay', 'MorningRoutine', 'NightRoutine', 'DayInTheLife', 'FamilyVlog', 'CoupleGoals', 'Vlogger', 'MiniVlog', 'BehindTheScenes', 'Storytime', 'Confession', 'QandA', 'MyTruth', 'Emotional', 'Surprise', 'Challenge', '24HoursChallenge', 'PrankWars', 'RoomTour', 'HouseTour', 'CarTour', 'Unfiltered', 'RealTalk', 'LifeUpdate', 'ProductivityVlog', 'StudyVlog', 'CleaningVlog', 'Organization', 'SatisfyingCleaning', 'Declutter', 'MovingVlog', 'ApartmentHunting', 'CollegeLife', 'HighSchool', 'GetReadyWithMe', 'GRWM', 'WeekendVlog', 'SoloDate', 'SelfCareDay', 'Vlogmas', 'WeeklyVlog', 'SilentVlog', 'AestheticVlog', 'SlowLiving', 'CottageCore', 'VanLife', 'NomadLife', 'GroceryShopping', 'HaulVideo', 'WhatIEatInADay', 'FitnessJourney', 'Transformation', 'RelationshipAdvice', 'StoryTime', 'TravelVlog'
        ],
        'travel': [
            'Travel', 'Trip', 'Vacation', 'Wanderlust', 'Adventure', 'Explore', 'Tourism', 'Backpacking', 'SoloTravel', 'RoadTrip', 'VanLife', 'HiddenGems', 'Nature', 'Mountains', 'Beach', 'Camping', 'HotelReview', 'FlightHack', 'BudgetTravel', 'LuxuryTravel', 'TravelGuide', 'StreetFoodTour', 'DigitalNomadLife', 'VisaTips', 'Passport', 'Airport', 'Hiking', 'Trekking', 'Staycation', 'TravelHacks', 'PackingTips', 'TravelVlogger', 'WorldTour', 'EuropeTrip', 'AsiaTravel', 'Maldives', 'Bali', 'Thailand', 'Dubai', 'Switzerland', 'TravelPhotography', 'DroneShots', 'CinematicTravel', 'Airbnb', 'HostelLife', 'Couchsurfing', 'TrainJourney', 'BusRide', 'FlightReview', 'BusinessClass', 'FirstClass', 'CruiseShip', 'ResortTour', 'Honeymoon', 'EcoTourism', 'SustainableTravel', 'LocalCulture', 'TouristTrap'
        ],
        'food': [
            'Foodie', 'Delicious', 'Recipe', 'Cooking', 'FoodPorn', 'Chef', 'StreetFood', 'Mukbang', 'ASMR', 'Yummy', 'DinnerIdeas', 'Baking', 'Cake', 'Chocolate', 'Spicy', 'IndianFood', 'ChineseFood', 'Pizza', 'Burger', 'HealthyRecipes', 'Vegan', 'Keto', 'DietFood', 'MealPrep', 'RestaurantReview', 'Buffet', 'Seafood', 'IceCream', 'Dessert', 'MasterChef', 'FoodChallenge', 'EatingShow', 'TasteTest', 'CheapVsExpensive', 'GordonRamsay', 'KitchenHacks', 'AirFryerRecipes', 'Smoothie', 'Coffee', 'Barista', 'Cocktails', 'Sushi', 'Pasta', 'Steak', 'BBQ', 'Grilling', 'FoodTruck', 'LocalEats', 'FoodVlog', 'CookingTutorial', 'EasyRecipes', '5MinuteRecipes', 'BreakfastIdeas', 'LunchBox', 'Snacks', 'ComfortFood', 'TraditionalFood', 'ExoticFood', 'SpicyChallenge', 'FoodReview'
        ],
        'funny': [
            'Comedy', 'Prank', 'Laugh', 'Memes', 'FunnyVideo', 'Savage', 'Humor', 'Skits', 'Roast', 'Vine', 'TryNotToLaugh', 'Entertainment', 'Fun', 'Jokes', 'StandUp', 'Parody', 'Bloopers', 'Fails', 'Cringe', 'TikTokCompilation', 'FunnyCats', 'FunnyDogs', 'MemeReview', 'ReactionVideo', 'YLYL', 'DankMemes', 'Wholesome', 'Relatable', 'ShortsComedy', 'SketchComedy', 'Impersonation', 'VoiceOver', 'Dubbing', 'FunnyMoments', 'Awkward', 'SocialExperiment', 'PublicPrank', 'Interviews', 'StreetInterview', 'Quiz', 'ChallengeVideo', 'GuessTheSong', 'Trivia', 'ComedyClub', 'FunnyShorts', 'DarkHumor', 'Sarcasm', 'DadJokes', 'ComedySkit', 'SituationalComedy', 'FailArmy', 'PeopleAreAwesome', 'Unexpected', 'FunnyBaby', 'LaughingChallenge'
        ],
        'music': [
            'Music', 'Song', 'Lyrics', 'Cover', 'Live', 'Concert', 'Beats', 'HipHop', 'Rap', 'Pop', 'Rock', 'Indie', 'LoFi', 'BassBoosted', 'Remix', 'SlowedAndReverb', 'Mashup', 'Singer', 'Guitar', 'Piano', 'Drum', 'NewMusic', 'Spotify', 'TrendingSong', 'MusicVideo', 'Kpop', 'BTS', 'Blackpink', 'VocalCoach', 'MusicProduction', 'FLStudio', 'Ableton', 'DJ', 'EDM', 'Acoustic', 'Unplugged', 'Instrumental', 'BackgroundMusic', 'CopyrightFree', 'NCS', 'Trap', 'Drill', 'R&B', 'Soul', 'Jazz', 'Classical', 'Opera', 'Synthwave', 'Phonk', 'GymMusic', 'StudyMusic', 'SleepMusic', 'MeditationMusic', '8D', 'AudioVisualizer', 'Karaoke', 'BinauralBeats', 'MusicTheory', 'Beatbox', 'RapBattle', 'NewSong2026', 'ViralSong', 'TiktokSong'
        ],
        'movie': [
            'Movie', 'Cinema', 'Film', 'Trailer', 'Review', 'Reaction', 'Netflix', 'Series', 'WebSeries', 'Anime', 'Hollywood', 'Bollywood', 'Marvel', 'DC', 'Avengers', 'Blockbuster', 'Oscars', 'Celebrity', 'Gossip', 'EasterEggs', 'Theory', 'Spoiler', 'Kdrama', 'Documentary', 'ShortFilm', 'Animation', 'CGI', 'VFX', 'Disney', 'Pixar', 'MovieRecap', 'Explained', 'EndingExplained', 'HiddenDetails', 'BehindTheScenes', 'DeletedScenes', 'Bloopers', 'CastInterview', 'RedCarpet', 'BoxOffice', 'Top10Movies', 'HorrorMovie', 'ActionMovie', 'SciFi', 'Thriller', 'RomCom', 'Drama', 'Sitcom', 'TVShow', 'StrangerThings', 'GameOfThrones', 'BreakingBad', 'MCU', 'DCEU', 'StarWars', 'HarryPotter', 'LordOfTheRings', 'MovieRecommendation', 'BestMoviesOnNetflix', 'AmazonPrime'
        ],
        'fitness': [
            'Fitness', 'Gym', 'Workout', 'Bodybuilding', 'Health', 'Motivation', 'FitFam', 'WeightLoss', 'FatLoss', 'Muscle', 'Abs', 'Cardio', 'HIIT', 'Crossfit', 'Yoga', 'Pilates', 'Stretching', 'Calisthenics', 'HomeWorkout', 'Transformation', 'Diet', 'Nutrition', 'Protein', 'HealthyLifestyle', 'GymRat', 'LegDay', 'SixPack', 'IntermittentFasting', 'Supplements', 'Creatine', 'FitnessModel', 'Wellness', 'MentalHealth', 'Meditation', 'Mindfulness', 'Zumba', 'Aerobics', 'Running', 'Marathon', 'Cycling', 'Swimming', 'MartialArts', 'Boxing', 'MMA', 'UFC', 'Kickboxing', 'SelfDefense', 'Physique', 'Bulking', 'Cutting', 'MealPlan', 'GymFail', 'GymHumor', 'Biohacking', 'ColdPlunge', 'Sauna', 'Mobility', 'FunctionalTraining', 'Powerlifting', 'Strongman'
        ],
        'beauty': [
            'Makeup', 'Beauty', 'Skincare', 'GlowUp', 'Fashion', 'Style', 'OOTD', 'Outfit', 'Haul', 'Shopping', 'Zara', 'H&M', 'StreetWear', 'Sneakers', 'HairCare', 'Hairstyle', 'Nails', 'Tutorial', 'Hack', 'DIY', 'Transformation', 'Model', 'Photoshoot', 'Aesthetic', 'Vintage', 'Thrifting', 'LuxuryBrands', 'Jewelry', 'MakeupArtist', 'Cosplay', 'GRWM', 'MorningRoutine', 'NightRoutine', 'FaceMask', 'AcneTreatment', 'NaturalBeauty', 'Perfume', 'Fragrance', 'Shoes', 'Bags', 'Accessories', 'Lookbook', 'SeasonalFashion', 'WinterOutfit', 'SummerOutfit', 'WeddingLook', 'PromLook', 'CelebrityStyle', 'KBeauty', 'GlassSkin', 'SustainableFashion', 'CapsuleWardrobe', 'ColorAnalysis'
        ],
        'learn': [
            'Tutorial', 'HowTo', 'Education', 'Learn', 'Study', 'Student', 'School', 'College', 'University', 'Exam', 'TipsAndTricks', 'LifeHacks', 'Productivity', 'SelfImprovement', 'Psychology', 'Philosophy', 'Science', 'Math', 'History', 'Facts', 'Documentary', 'Explained', 'GeneralKnowledge', 'CurrentAffairs', 'BookSummary', 'OnlineCourse', 'SkillShare', 'Udemy', 'Coursera', 'LanguageLearning', 'EnglishSpeaking', 'IELTS', 'TOEFL', 'SAT', 'GRE', 'GMAT', 'Scholarship', 'StudyAbroad', 'Physics', 'Chemistry', 'Biology', 'Astronomy', 'Space', 'NASA', 'Geography', 'Politics', 'Economics', 'Finance101', 'InvestingForBeginners', 'SoftSkills', 'PublicSpeaking', 'Communication', 'Leadership', 'CriticalThinking', 'Logic', 'Research', 'Thesis', 'StudyHacks', 'Focus', 'MemoryTechniques'
        ],
        'coding': [
            'Programming', 'Coding', 'Developer', 'WebDevelopment', 'AppDevelopment', 'Python', 'JavaScript', 'HTML', 'CSS', 'React', 'NodeJS', 'FullStack', 'SoftwareEngineer', 'CodeLife', 'TechCareer', 'Git', 'GitHub', 'VSCode', 'Debugging', 'Frontend', 'Backend', 'Database', 'SQL', 'MongoDB', 'DevOps', 'Cloud', 'API', 'Framework', 'LeetCode', 'SystemDesign', 'OpenSource', 'CyberSecurity', 'EthicalHacking', 'BugBounty', 'Linux', 'Bash', 'Docker', 'Kubernetes', 'Java', 'C++', 'C#', 'Rust', 'GoLang', 'Swift', 'Flutter', 'ReactNative', 'AndroidStudio', 'Xcode', 'GameDevelopment', 'Unity', 'UnrealEngine', 'Arduino', 'RaspberryPi', 'NextJS', 'TypeScript', 'TailwindCSS', 'Web3Development', 'SmartContract', 'Solidity'
        ],
        'design': [
            'GraphicDesign', 'Photoshop', 'Illustrator', 'Figma', 'UIUX', 'LogoDesign', 'VideoEditing', 'PremierePro', 'AfterEffects', 'Photography', 'PhotoShoot', 'Lightroom', 'Editing', 'Cinematic', 'Filmmaking', 'ColorGrading', 'MotionGraphics', 'Animation', 'Blender3D', 'Canva', 'ThumbnailDesign', 'FreelanceDesigner', 'ArtDirector', 'Creative', 'Typography', 'Branding', 'PosterDesign', 'SocialMediaDesign', 'WebDesign', 'LandingPage', 'Procreate', 'DigitalArt', 'Sketching', 'Drawing', 'Illustration', 'NFTArt', 'ConceptArt', 'CharacterDesign', '3DModeling', 'VFX', 'SoundDesign', 'Architecture', 'InteriorDesign', 'FashionDesign', 'IndustrialDesign', 'GenerativeArt'
        ],
        'cars': [
            'Cars', 'Supercars', 'Automotive', 'Drift', 'Racing', 'Speed', 'Luxury', 'BMW', 'Mercedes', 'Tesla', 'Ferrari', 'Lamborghini', 'JDM', 'CarReview', 'Modified', 'Bike', 'Motorcycle', 'MotoVlog', 'OffRoad', '4x4', 'Trucks', 'ElectricVehicle', 'EV', 'Hybrid', 'DragRace', 'TopSpeed', 'ExhaustSound', 'CrashTest', 'Mechanic', 'Restoration', 'Formula1', 'MotoGP', 'CarMeet', 'Detailing', 'CarWash', 'EngineBuild', 'Turbo', 'Supercharger', 'Tuning', 'CarHacks', 'Driving', 'RoadSafety', 'Traffic', 'PoliceChase', 'Dashcam', 'ClassicCars', 'MuscleCars', 'Toyota', 'Honda', 'Ford', 'Audi', 'Porsche', 'Bugatti', 'Koenigsegg', 'Hypercar', 'CarCamping', 'Overlanding', 'Rimac', 'LucidAir', 'Cybertruck'
        ],
        'diy': [
            'DIY', 'Crafts', 'LifeHacks', 'HomeDecor', 'InteriorDesign', 'Renovation', 'Woodworking', 'Pottery', 'Knitting', 'Sewing', 'Upcycling', 'Restoration', 'ToolRestoration', 'Handmade', 'ArtAndCraft', 'PaperCraft', 'Origami', 'Painting', 'Sketching', 'Calligraphy', 'SatisfyingArt', 'ResinArt', 'ClayArt', '5MinuteCrafts', 'Organization', 'Cleaning', 'RoomMakeover', 'FurnitureFlip', 'Construction', 'Architecture', 'TinyHouse', 'SmartHome', 'GadgetsForHome', 'KitchenHacks', 'Gardening', 'Plants', 'FlowerArrangement', 'CandleMaking', 'SoapMaking', 'JewelryMaking', 'LeatherCraft', 'MetalWorking', 'Welding', '3DPrintingIdeas', 'LaserCutting', 'Cricut'
        ],
        'garden': [
            'Gardening', 'Plants', 'Nature', 'Flowers', 'IndoorPlants', 'HomeGarden', 'Farming', 'Agriculture', 'Sustainability', 'EcoFriendly', 'Permaculture', 'Harvest', 'VegetableGarden', 'Succulents', 'Bonsai', 'Landscaping', 'LawnCare', 'TreePlanting', 'Hydroponics', 'OrganicFarming', 'Composting', 'Greenhouse', 'FloralDesign', 'PlantMom', 'UrbanGardening', 'Homesteading', 'SelfSufficiency', 'ChickenKeeping', 'Beekeeping', 'OffGrid'
        ],
        'animals': [
            'Animals', 'Pets', 'Cute', 'Cat', 'Dog', 'Puppy', 'Kitten', 'FunnyAnimals', 'Wildlife', 'Nature', 'Zoo', 'Rescue', 'AnimalLover', 'DogTraining', 'Aquarium', 'Fish', 'Bird', 'Parrot', 'Horse', 'Reptile', 'Snake', 'Spider', 'ExoticPets', 'Satisfying', 'CatVideos', 'DogVideos', 'AnimalRescue', 'Vet', 'AnimalFacts', 'NatGeo', 'Discovery', 'Safari', 'Underwater', 'MarineLife', 'Insects', 'MacroPhotography', 'PetCare', 'DogGrooming', 'CatMeowing', 'FunnyPetFails', 'GoldenRetriever', 'Husky', 'GermanShepherd', 'StrayDog', 'AnimalRights', 'Conservation', 'WildEarth', 'BBCEarth', 'CuteMoments'
        ],
        'motivation': [
            'Motivation', 'Inspiration', 'Success', 'Mindset', 'Quotes', 'Speech', 'Discipline', 'Focus', 'Goals', 'DreamBig', 'Hustle', 'Grind', 'Positivity', 'MentalHealth', 'SelfCare', 'Meditation', 'Mindfulness', 'Stoicism', 'Philosophy', 'LifeLessons', 'Rich', 'LuxuryLife', 'Billionaire', 'LawOfAttraction', 'Manifestation', 'Affirmations', 'MorningMotivation', 'StudyMotivation', 'WorkoutMotivation', 'SigmaMale', 'Alpha', 'HighValue', 'AndrewTate', 'DavidGoggins', 'JordanPeterson', 'TonyRobbins', 'GaryVee', 'Spirituality', 'Awakening', 'MonkMode', 'DopamineDetox', 'FinancialFreedom', 'EntrepreneurLife', 'NeverGiveUp'
        ],
        'asmr': [
            'ASMR', 'Relaxing', 'Sleep', 'Tapping', 'Whispering', 'Triggers', 'Satisfying', 'OddlySatisfying', 'Slime', 'SandCutting', 'SoapCutting', 'Calm', 'RainSounds', 'WhiteNoise', 'StudyMusic', 'StressRelief', 'Massage', 'Chiropractor', 'MukbangASMR', 'KeyboardSounds', 'RoleplayASMR', 'MedicalASMR', 'EarCleaning', 'HeadMassage', 'Spa', 'Cracking', 'Crunchy', 'KineticSand', 'PaintMixing', 'HydraulicPress', 'Shredding', 'CarpetCleaning', 'PressureWashing', 'RestorationASMR', 'CookingASMR', 'TypingASMR', 'ChalkCrushing'
        ],
        'news': [
            'News', 'BreakingNews', 'Politics', 'CurrentEvents', 'WorldNews', 'Updates', 'Report', 'Journalism', 'Interview', 'Debate', 'Documentary', 'Truth', 'Investigation', 'Weather', 'SportsNews', 'TechNews', 'CryptoNews', 'CelebrityNews', 'ViralNews', 'TrendingNews', 'LiveNews', 'BBC', 'CNN', 'FoxNews', 'AlJazeera', 'Podcast', 'JoeRogan', 'LexFridman', 'TrueCrime', 'Mystery', 'Conspiracy', 'HistoryChannel', 'Unsolved', 'War', 'Economy', 'Election2026', 'ClimateChange', 'GlobalWarming', 'Protest', 'HumanRights'
        ],
        'kids': [
            'Kids', 'Children', 'Toys', 'NurseryRhymes', 'Cartoons', 'LearningColors', 'Alphabet', 'KidsSong', 'Baby', 'Toddler', 'Parenting', 'FamilyFun', 'Playground', 'ToyReview', 'Lego', 'Disney', 'PeppaPig', 'Cocomelon', 'PawPatrol', 'MinecraftForKids', 'RobloxForKids', 'EducationalVideo', 'BedtimeStory', 'FairyTales', 'MagicShow', 'ScienceForKids', 'ArtsAndCraftsForKids', 'SchoolProject', 'Kindergarten', 'Preschool', 'FunnyKids', 'BabyShark', 'Montessori', 'SensoryPlay'
        ]
    },

    // =========================================================================
    // [SECTION 3: BANGLA LOCALIZATION MAPS — DO NOT MODIFY]
    // Two maps that power the Bengali Mode:
    // banglaTriggers — detects if a Bangla-related category was typed.
    // banglaMap      — returns the matching set of Bangla hashtags.
    // =========================================================================

    /**
     * @type {Object.<string, string[]>}
     * Maps category names to Bangla trigger words.
     * If the user's input contains any trigger word for a category,
     * the corresponding banglaMap entry is added to the output.
     */
    banglaTriggers: {
        'viral'       : ['ভাইরাল', 'ট্রেন্ড', 'হট', 'নতুন', 'জনপ্রিয়'],
        'funny'       : ['মজা', 'হাসি', 'ফানি', 'কৌতুক', 'রম্য', 'বিনুদুন'],
        'vlog'        : ['ভ্লগ', 'ঘুরাঘুরি', 'ভ্রমণ', 'লাইফস্টাইল', 'দিনকাল'],
        'tech'        : ['টেক', 'মোবাইল', 'ফোন', 'রিভিউ', 'আনবক্সিং', 'গ্যাজেট'],
        'freelancing' : ['ইনকাম', 'টাকা', 'ফ্রিল্যান্সিং', 'আউটসোর্সিং', 'উপার্জন'],
        'food'        : ['খাবার', 'রেসিপি', 'রান্না', 'ভোজন', 'ফুড'],
        'game'        : ['গেম', 'খেলা', 'ফ্রি ফায়ার', 'পাবজি'],
        'sports'      : ['ক্রিকেট', 'ফুটবল', 'খেলাধুলা', 'ম্যাচ'],
        'news'        : ['খবর', 'সংবাদ', 'নিউজ', 'ঘটনা'],
        'islamic'     : ['ওয়াজ', 'গজল', 'ইসলাম', 'কোরআন', 'হাদিস'],
        'education'   : ['পড়া', 'শিক্ষা', 'ক্লাস', 'পরীক্ষা', 'রেজাল্ট']
    },

    /**
     * @type {Object.<string, string[]>}
     * Maps category names to their full Bangla hashtag sets.
     * These are injected when banglaTriggers detects a match
     * or when the Bangla Mode filter is manually activated.
     */
    banglaMap: {
        'viral'       : ['#ভাইরাল', '#ট্রেন্ডিং', '#বাংলাদেশ', '#ভিডিও', '#fyp', '#ফরইউ', '#সোশ্যাল_মিডিয়া', '#বাংলা', '#ব্রেকিং_নিউজ', '#নতুন', '#জনপ্রিয়', '#ভাইরাল_ভিডিও', '#টিকটক', '#রিলস', '#ইউটিউব', '#ফেসবুক', '#ইnstagram', '#স্লথ', '#বাঙালি', '#ঢাকা', '#কলকাতা', '#BDTrending', '#BanglaViral', '#ShortsBD', '#BdTiktok'],
        'funny'       : ['#মজার_ভিডিও', '#হাসির_ভিডিও', '#কমেডি', '#ফানি', '#রিলস', '#মিমস', '#বিনোদন', '#নাটক', '#বাংলা_নাটক', '#শর্টফিল্ম', '#হাসি', '#কৌতুক', '#ট্রল', '#রোমান্টিক', '#প্র্যাঙ্ক', '#মজা', '#আড্ডা', '#বাউল', '#গান', '#MosharrafKarim', '#AfranNisho', '#ChoncholChowdhury', '#BachelorPoint', '#BanglaFunnyVideo'],
        'vlog'        : ['#ভ্লগ', '#লাইফস্টাইল', '#আজকের_দিন', '#গ্রাম_বাংলা', '#ভ্রমণ', '#ব্লগার', '#ডেইলি_ভ্লগ', '#আমার_জীবন', '#সকাল', '#বিকাল', '#ঘুরাঘুরি', '#প্রকৃতি', '#নদী', '#পাহাড়', '#সমুদ্র', '#কক্সবাজার', '#সিলেট', '#সুন্দরবন', '#সাজেক', '#বাসা', '#পরিবার', '#BanglaVlog', '#BdVlogger', '#VillageLife', '#DeshiVlog'],
        'tech'        : ['#প্রযুক্তি', '#টেক', '#রিভিউ', '#স্মার্টফোন', '#মোবাইল', '#আনবক্সিং', '#গ্যাজেট', '#টিউটোরিয়াল', '#কম্পিউটার', '#ল্যাপটপ', '#ইন্টারনেট', '#সফটওয়্যার', '#অ্যাপ', '#এআই', '#বিজ্ঞান', '#আবিষ্কার', '#নতুন_প্রযুক্তি', '#টেক_নিউজ', '#মোবাইল_রিভিউ', '#বাংলা_টেক', '#সায়েন্স', '#TechnicalGurujiBangla'],
        'freelancing' : ['#ফ্রিল্যান্সিং', '#আউটসোর্সিং', '#টাকা_ইনকাম', '#অনলাইন_ইনকাম', '#ডিজিটাল_মার্কেটিং', '#উদ্যোক্তা', '#ক্যারিয়ার', '#চাকরি', '#ব্যবসা', '#শেয়ার_বাজার', '#টাকা', '#পয়সা', '#সাফল্য', '#মোটিভেশন', '#শিক্ষার্থী', '#বেকারত্ব', '#উন্নয়ন', '#MakeMoneyOnlineBD', '#BanglaTutorial', '#FiverrBangla', '#UpworkBangla'],
        'food'        : ['#রান্না', '#রেসিপি', '#খাবার', '#সুস্বাদু', '#ভোজনরসিক', '#স্ট্রিট_ফুড', '#বাঙালি_খাবার', '#পিঠা', '#বিরিয়ানি', '#ইলিশ', '#ভর্তা', '#মাংস', '#মিষ্টি', '#ফাস্টফুড', '#ফুড_ব্লগ', '#রান্নাবান্না', '#হেঁশেল', '#দেশি_খাবার', '#BanglaRecipe', '#KacchiBiryani', '#FoodVlogBD', '#VillageCooking'],
        'game'        : ['#গেম', '#গেমিং', '#লাইভ', '#খেলা', '#ফ্রি_ফায়ার', '#পাবজি', '#স্ট্রিমার', '#মোবাইল_গেম', '#পিসি_গেম', '#বাংলাদেশ_গেমার', '#টপ_আপ', '#ইভেন্ট', '#গেমপ্লে', '#হেডশট', '#র‍্যাংক', '#BanglaGaming', '#FreeFireBD', '#PubgMobileBD', '#GamerBD'],
        'sports'      : ['#ক্রিকেট', '#বাংলাদেশ_ক্রিকেট', '#সাকিব_আল_হাসান', '#ফুটবল', '#খেলাধুলা', '#ম্যাচ', '#লাইভ_খেলা', '#তামিম', '#মুশফিক', '#বিপিএল', '#আইপিএল', '#বিশ্বকাপ', '#আর্জেন্টিনা', '#ব্রাজিল', '#মেসি', '#নেইমার', '#গোল', '#Tigers', '#BDCricket', '#FootballBD'],
        'news'        : ['#খবর', '#সংবাদ', '#বাংলাদেশ_সংবাদ', '#আজকের_খবর', '#রাজনীতি', '#লাইভ_নিউজ', '#ব্রেকিং', '#দেশ', '#বিদেশ', '#আবহাওয়া', '#দুর্ঘটনা', '#অপরাধ', '#সমসাময়িক', '#টকশো', '#পত্রিকা', '#ChannelI', '#SomoyTV', '#JamunaTV', '#BDNews24'],
        'islamic'     : ['#ইসলামিক', '#ওয়াজ', '#কোরআন', '#নামাজ', '#গজল', '#দ্বীন', '#হাদিস', '#বয়ান', '#সুন্নাত', '#নবী', '#রাসুল', '#দোয়া', '#জিকির', '#জান্নাত', '#জাহান্নাম', '#মসজিদ', '#মাদ্রাসা', '#মুসলিম', '#BanglaWaz', '#IslamicSong', '#Gojol', '#MizanurRahmanAzhari'],
        'education'   : ['#পড়াশোনা', '#স্কুল', '#কলেজ', '#বিশ্ববিদ্যালয়', '#ভর্তি', '#পরীক্ষা', '#রেজাল্ট', '#বিসিএস', '#সাধারণ_জ্ঞান', '#ইংরেজি_শেখা', '#গণিত', '#বিজ্ঞান', '#ইতিহাস', '#সাহিত্য', '#কবিতা', '#বই', '#BanglaTutorial', '#BCSPreparation', '#HSC', '#SSC']
    },


    // =========================================================================
    // [SECTION 4: INITIALIZATION]
    // =========================================================================

    /**
     * init()
     * Entry point. Waits for the DOM to be fully loaded before calling
     * the UI setup, theme, visual, and history functions.
     */
    init: function() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupUI();
            this.initTheme();
            this.initVisuals();
            this.loadHistory();
        });
    },

    /**
     * setupUI()
     * Injects dynamic DOM elements that are not present in the static HTML:
     * 1. The Bangla filter chip (appended to .filters-group).
     * 2. The character counter div (inserted after .results-box).
     * 3. The history container div (inserted after .input-wrapper).
     * All three are created only if they don't already exist (idempotent).
     */
    setupUI: function() {
        // ── 1. Inject Bangla Filter Chip ──────────────────────────────────────
        const filterGroup = document.querySelector('.filters-group');
        if (filterGroup && !document.getElementById('bangla-filter-btn')) {
            const banglaBtn       = document.createElement('div');
            banglaBtn.className   = 'utg-filter-chip';
            banglaBtn.id          = 'bangla-filter-btn';
            banglaBtn.innerHTML   = '<i class="fa-solid fa-language"></i> Bengali';
            banglaBtn.onclick     = function() { UltraTag.toggleFilter(this, 'bangla'); };
            filterGroup.appendChild(banglaBtn);
        }

        // ── 2. Inject YouTube Character Counter ───────────────────────────────
        // Sits below the results box; hidden until YouTube platform is active.
        const resultsBox = document.querySelector('.results-box');
        if (resultsBox && !document.getElementById('char-counter')) {
            const counter         = document.createElement('div');
            counter.id            = 'char-counter';
            counter.style.cssText = 'font-size:12px;color:var(--text-muted);margin-top:8px;text-align:right;width:100%;display:none;';
            resultsBox.parentNode.insertBefore(counter, resultsBox.nextSibling);
        }

        // ── 3. Inject History Container ───────────────────────────────────────
        // Sits between the input wrapper and the results box.
        const inputWrapper = document.querySelector('.input-wrapper');
        if (inputWrapper && !document.getElementById('history-container')) {
            const historyDiv  = document.createElement('div');
            historyDiv.id     = 'history-container';
            inputWrapper.parentNode.insertBefore(historyDiv, inputWrapper.nextSibling);
        }
    },


    // =========================================================================
    // [SECTION 5: THEME ENGINE]
    // =========================================================================

    /**
     * initTheme()
     * Reads the 'theme' key from localStorage on page load.
     * If the user previously selected 'light', the .light-mode class is
     * applied to <body>, triggering the CSS variable overrides in Section 1
     * of tools-template.css.
     * Note: Theme toggling is handled by global.js; this just restores state.
     */
    initTheme: function() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-mode');
        }
    },

    /**
     * toggleTheme()
     * Toggles the .light-mode class on <body> and persists the new
     * preference to localStorage. Notifies the user via the global toast.
     */
    toggleTheme: function() {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        window.showToast(isLight ? '☀️ Light Mode Activated' : '🌙 Dark Mode Activated');
    },


    // =========================================================================
    // [SECTION 6: VISUAL ENGINE — CANVAS PARTICLE NETWORK]
    // =========================================================================

    /**
     * initVisuals()
     * Sets up a hardware-accelerated canvas animation that renders a
     * floating particle network in the page background.
     *
     * Features:
     * - Retina/HiDPI display support via devicePixelRatio scaling.
     * - Adaptive particle count (30 on mobile, 60 on desktop) to reduce
     *   GPU load on low-powered devices.
     * - Line drawn between particles within 100px of each other, fading
     *   with distance, creating an organic network effect.
     * - IntersectionObserver pauses animation when the canvas is off-screen
     *   to conserve battery on mobile.
     */
    initVisuals: function() {
        const canvas = document.getElementById('network-canvas');
        if (!canvas) return;

        const ctx               = canvas.getContext('2d');
        let   particles         = [];
        let   animationFrameId;

        /**
         * resizeCanvas()
         * Recalculates canvas dimensions to match the viewport,
         * accounting for the device pixel ratio for sharp rendering.
         */
        const resizeCanvas = () => {
            const dpr      = window.devicePixelRatio || 1;
            canvas.width   = window.innerWidth  * dpr;
            canvas.height  = window.innerHeight * dpr;
            ctx.scale(dpr, dpr);
        };

        // Rebuild particle array on viewport resize to prevent overflow
        window.addEventListener('resize', () => {
            resizeCanvas();
            particles = [];
            createParticles();
        });
        resizeCanvas();

        /**
         * Particle class
         * Each instance represents one floating node in the network.
         * Velocity is intentionally slow (±0.4) for a calm, ambient feel.
         */
        class Particle {
            constructor() {
                this.x    = Math.random() * window.innerWidth;
                this.y    = Math.random() * window.innerHeight;
                this.vx   = (Math.random() - 0.5) * 0.4;
                this.vy   = (Math.random() - 0.5) * 0.4;
                this.size = Math.random() * 2;
            }

            /** Moves the particle and bounces it off viewport edges. */
            update() {
                this.x += this.vx;
                this.y += this.vy;
                if (this.x < 0 || this.x > window.innerWidth)  this.vx *= -1;
                if (this.y < 0 || this.y > window.innerHeight)  this.vy *= -1;
            }

            /** Draws the particle as a small filled circle. */
            draw() {
                ctx.fillStyle = 'rgba(139, 92, 246, 0.3)';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        /**
         * createParticles()
         * Populates the particles array. Limits count to 30 on mobile
         * to prevent performance issues on lower-end devices.
         */
        function createParticles() {
            const count = window.innerWidth < 600 ? 30 : 60;
            for (let i = 0; i < count; i++) {
                particles.push(new Particle());
            }
        }
        createParticles();

        /**
         * animateParticles()
         * Main render loop. Clears the canvas, updates/draws every particle,
         * and then checks each pair for proximity to draw connecting lines.
         * Uses requestAnimationFrame for smooth, GPU-synced rendering.
         */
        function animateParticles() {
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();

                // Draw a line between nearby particles
                for (let j = i; j < particles.length; j++) {
                    const dx       = particles[i].x - particles[j].x;
                    const dy       = particles[i].y - particles[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 100) {
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(139, 92, 246, ${0.1 - distance / 1000})`;
                        ctx.lineWidth   = 0.5;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }
            animationFrameId = requestAnimationFrame(animateParticles);
        }

        // Pause animation when canvas scrolls out of viewport (battery saving)
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                if (!animationFrameId) animateParticles();
            } else {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        });
        observer.observe(canvas);
        animateParticles();
    },


    // =========================================================================
    // [SECTION 7: CORE TAG GENERATION LOGIC]
    // =========================================================================

    /**
     * processTags()
     * Entry point for the tag generation pipeline, called by the HTML button.
     * 1. Validates that the keyword field is not empty.
     * 2. Saves the keyword to the history system.
     * 3. Shows a loading spinner in the output box.
     * 4. Hides the action bar while loading.
     * 5. Calls generateTags() after a 600ms delay (simulates AI processing).
     */
    processTags: function() {
        const rawInput = document.getElementById('keyword').value.trim();

        // Guard: require input before generating
        if (!rawInput) {
            window.showToast('⚠️ Please enter a keyword!', true);
            return;
        }

        this.addToHistory(rawInput);

        // Show loading spinner in the output area
        const output     = document.getElementById('output');
        output.innerHTML = `
            <div style="text-align:center;padding:20px;width:100%;">
                <i class="fa-solid fa-circle-notch fa-spin" style="color:#8b5cf6;font-size:2rem;"></i>
                <br><br>
                <small style="color:var(--text-muted);">AI ANALYZING KEYWORDS...</small>
            </div>`;

        // Hide action buttons until generation is complete
        document.getElementById('tools-bar').classList.add('hidden');

        // Delayed execution to allow the loading UI to render first
        setTimeout(() => { this.generateTags(rawInput); }, 600);
    },

    /**
     * generateTags()
     * Core algorithm that builds the final tag list.
     *
     * Pipeline:
     * 1. Normalize input — strip special chars, lowercase for matching.
     * 2. Add base tags (exact input + year variant).
     * 3. Bangla mode — if the filter is active or Bangla script is detected,
     *    scan banglaTriggers and inject matching banglaMap entries.
     * 4. English mode — scan knowledgeBase keys for substring matches.
     *    Up to 20 random tags per matching category.
     * 5. Fallback — if no matches found, inject generic viral filler tags.
     * 6. Platform boosters — append platform-specific global hashtags.
     * 7. Deduplicate (Set), shuffle, slice to maxTags (50), then render.
     *
     * @param {string} input - The raw user keyword string.
     */
    generateTags: function(input) {
        const year       = new Date().getFullYear();
        // Allow only alphanumeric, Bangla Unicode block (U+0980–U+09FF), and spaces
        const cleanInput = input.replace(/[^a-zA-Z0-9\u0980-\u09FF\s]/g, '');
        const lowerInput = cleanInput.toLowerCase();
        // Tag-safe version: no spaces
        const cleanTag   = cleanInput.replace(/\s/g, '');

        // Use a Set for automatic deduplication
        let tags = new Set();

        // ── Step 1: Base Tags ────────────────────────────────────────────────
        tags.add(`#${cleanTag}`);
        tags.add(`#${cleanTag}${year}`);

        // ── Step 2: Bangla Semantic Matching ─────────────────────────────────
        if ((this.activeFilters.bangla || /[\u0980-\u09FF]/.test(input)) && this.banglaTriggers) {
            Object.keys(this.banglaTriggers).forEach(category => {
                const hasTrigger = this.banglaTriggers[category].some(t => lowerInput.includes(t));
                if (hasTrigger && this.banglaMap[category]) {
                    this.banglaMap[category].forEach(tag => tags.add(tag));
                }
            });
        }

        // ── Step 3: English Semantic Matching ────────────────────────────────
        let foundCategories = 0;
        Object.keys(this.knowledgeBase).forEach(key => {
            if (lowerInput.includes(key) || key.includes(lowerInput)) {
                foundCategories++;
                // Pick up to 20 random tags from the matched category
                const categoryTags = this.knowledgeBase[key];
                const shuffled     = [...categoryTags].sort(() => 0.5 - Math.random());
                shuffled.slice(0, 20).forEach(word => tags.add(`#${word}`));
            }
        });

        // ── Step 4: Fallback Fillers ─────────────────────────────────────────
        if (foundCategories === 0 || tags.size < 5) {
            tags.add(`#${cleanTag}Video`);
            tags.add(`#${cleanTag}Viral`);
            tags.add('#TrendingNow');
            // If multi-word input, also tag the last word alone
            const words = cleanInput.split(' ');
            if (words.length > 1) tags.add(`#${words[words.length - 1]}`);
        }

        // ── Step 5: Platform-Specific Boosters ──────────────────────────────
        const boosters = {
            'youtube'   : ['#Shorts', '#Trending', '#Viral', '#SEO'],
            'instagram' : ['#ExplorePage', '#InstaDaily', '#ViralReels'],
            'tiktok'    : ['#FYP', '#ForYou', '#ViralVideo', '#Trending'],
            'facebook'  : ['#FacebookPost', '#Watch', '#Viral']
        };
        if (boosters[this.currentPlatform]) {
            boosters[this.currentPlatform].forEach(b => tags.add(b));
        }

        // ── Step 6: Finalize — shuffle, slice, assign competition scores ─────
        let finalTags = Array.from(tags).sort(() => Math.random() - 0.5).slice(0, this.maxTags);

        /**
         * Assign a simulated competition score to each tag.
         * Distribution: ~25% high, ~30% medium, ~45% low.
         * This gives new channels more "green" (easy-rank) tags by default.
         */
        this.currentTags = finalTags.map(tag => ({
            text : tag,
            comp : Math.random() < 0.25 ? 'high' : (Math.random() < 0.55 ? 'med' : 'low')
        }));

        this.renderTags();
        document.getElementById('tools-bar').classList.remove('hidden');

        // Notify user of result
        if (finalTags.length > 0) {
            window.showToast(`✅ Generated ${finalTags.length} Optimized Tags!`);
        } else {
            window.showToast('⚠️ No relevant tags found.', true);
        }
    },

    /**
     * renderTags()
     * Clears the output box and re-renders all tags in `this.currentTags`
     * as individual `.tag-pill` elements.
     *
     * Each pill:
     * - Displays a colored competition dot (red/yellow/green).
     * - Has a staggered fadeInUp animation (20ms delay per pill).
     * - Is click-toggleable (.selected class) for partial copy.
     * - Triggers updateCharCounter() on click to keep the count live.
     *
     * YouTube formatting: strips the leading `#` and appends a comma.
     * Other platforms: keeps the `#` prefix.
     */
    renderTags: function() {
        const output     = document.getElementById('output');
        output.innerHTML = '';

        this.currentTags.forEach((item, i) => {
            let displayTag = item.text;

            // YouTube format: strip # and add trailing comma for easy paste
            if (this.currentPlatform === 'youtube' && this.useCommas) {
                displayTag = item.text.replace('#', '') + ',';
            }

            // Map competition level to dot color
            const dotColor = item.comp === 'high' ? '#ef4444' : (item.comp === 'med' ? '#eab308' : '#238636');

            const pill                = document.createElement('div');
            pill.className            = 'tag-pill';
            pill.style.animationDelay = `${i * 0.02}s`;
            pill.innerHTML            = `<span style="color:${dotColor};font-size:10px;margin-right:6px;">●</span>${displayTag}`;

            // Toggle selection state for targeted copy
            pill.onclick = function() {
                this.classList.toggle('selected');
                UltraTag.updateCharCounter();
            };
            output.appendChild(pill);
        });

        this.updateCharCounter();
    },

    /**
     * updateCharCounter()
     * Calculates and displays the running character count for YouTube tags.
     * YouTube has a 500-character limit for the tag field.
     *
     * - If selected pills exist, counts only those; otherwise counts all.
     * - Strips the competition dot character (●) from the text before counting.
     * - Turns the count red if the 500-char limit is exceeded.
     * - Hidden on non-YouTube platforms.
     */
    updateCharCounter: function() {
        const counter = document.getElementById('char-counter');
        if (!counter) return;

        if (this.currentPlatform === 'youtube' && this.currentTags.length > 0) {
            const selected = document.querySelectorAll('.tag-pill.selected');
            const source   = selected.length > 0 ? Array.from(selected) : document.querySelectorAll('.tag-pill');

            let totalChars = 0;
            source.forEach(el => {
                // Remove the competition dot and surrounding whitespace
                let text    = el.innerText.replace('●', '').trim();
                totalChars += text.length;
                totalChars += 1; // Account for comma/space separator
            });
            if (totalChars > 0) totalChars -= 1; // Remove trailing separator

            counter.style.display = 'block';
            counter.innerHTML     = `Characters: <span style="color:${totalChars > 500 ? '#ef4444' : '#238636'}">${totalChars}</span> / 500`;
        } else {
            counter.style.display = 'none';
        }
    },


    // =========================================================================
    // [SECTION 8: PLATFORM & FILTER CONTROLS]
    // =========================================================================

    /**
     * switchPlatform()
     * Switches the active platform context and updates the UI accordingly.
     *
     * Actions:
     * - Updates `this.currentPlatform`.
     * - Toggles `.active` class on the platform buttons.
     * - Shows/hides the separator toggle (only visible for YouTube).
     * - Updates the input placeholder to match the platform context.
     * - Re-renders existing tags if any are loaded (reformats them live).
     *
     * @param {string} platform - One of 'youtube', 'instagram', 'tiktok', 'facebook'.
     * @param {HTMLElement} btn - The clicked platform button element.
     */
    switchPlatform: function(platform, btn) {
        this.currentPlatform = platform;

        // Deactivate all, then activate the clicked one
        document.querySelectorAll('.utg-p-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const input        = document.getElementById('keyword');
        const separatorBtn = document.getElementById('separator-toggle');

        // The comma/separator toggle only makes sense for YouTube
        if (platform === 'youtube') {
            if (separatorBtn) separatorBtn.style.display = 'flex';
            if (!this.useCommas) this.toggleSeparator(separatorBtn);
        } else {
            if (separatorBtn) separatorBtn.style.display = 'none';
            if (this.useCommas) this.toggleSeparator(separatorBtn);
        }

        // Context-aware placeholder text per platform
        const placeholders = {
            'youtube'   : 'Video Topic (e.g. Minecraft, Tech)...',
            'instagram' : 'Context (e.g. Nature, Selfie)...',
            'tiktok'    : 'Trend (e.g. Dance, Challenge)...',
            'facebook'  : 'Topic (e.g. News, Update)...'
        };
        input.placeholder = placeholders[platform] || 'Enter keyword...';

        // Live-reformat existing tags for the new platform
        if (this.currentTags.length > 0) this.renderTags();
    },

    /**
     * toggleFilter()
     * Activates or deactivates a filter chip and updates the corresponding
     * flag in `this.activeFilters`.
     * Special case: shows a toast when Bangla mode is turned ON.
     *
     * @param {HTMLElement} btn  - The filter chip element that was clicked.
     * @param {string}      type - The filter key: 'viral', 'niche', or 'bangla'.
     */
    toggleFilter: function(btn, type) {
        btn.classList.toggle('checked');
        this.activeFilters[type] = btn.classList.contains('checked');
        if (type === 'bangla' && this.activeFilters.bangla) {
            window.showToast('🇧🇩 Bangla Mode ON');
        }
    },

    /**
     * toggleSeparator()
     * Flips the `useCommas` flag and visually reflects the state on the chip.
     * Re-renders tags live if any are displayed, so the user sees the format
     * change immediately without re-generating.
     *
     * @param {HTMLElement} btn - The separator filter chip element.
     */
    toggleSeparator: function(btn) {
        this.useCommas = !this.useCommas;
        if (btn) btn.classList.toggle('checked');
        if (this.currentTags.length > 0) this.renderTags();
    },


    // =========================================================================
    // [SECTION 9: CLIPBOARD SYSTEM]
    // =========================================================================

    /**
     * copySelectedOrAll()  [async]
     * Copies either the selected (highlighted) tags or all tags to clipboard.
     *
     * Logic:
     * - If any .tag-pill.selected elements exist, copy only those.
     * - Otherwise, copy all rendered pills.
     * - YouTube: output is comma-separated with no `#` prefix.
     * - Other platforms: output is space-separated with `#` prefix.
     *
     * Fallback strategy:
     * - Primary: navigator.clipboard.writeText() (modern async API).
     * - Fallback: creates a hidden <textarea>, selects it, and uses
     *   document.execCommand('copy') for older browsers and WebViews.
     */
    copySelectedOrAll: async function() {
        const selected = document.querySelectorAll('.tag-pill.selected');
        const source   = selected.length > 0 ? Array.from(selected) : document.querySelectorAll('.tag-pill');

        if (source.length === 0) return;

        // Clean each pill text (remove dot character and trailing comma)
        let tagsToCopy = [];
        source.forEach(el => {
            let text = el.innerText.replace('●', '').trim();
            if (text.endsWith(',')) text = text.slice(0, -1);
            tagsToCopy.push(text);
        });

        // Format the final string based on platform
        let finalString = '';
        if (this.currentPlatform === 'youtube') {
            // YouTube: no # prefix, comma-separated
            finalString = tagsToCopy.map(t => t.replace('#', '')).join(', ');
        } else {
            // Other platforms: ensure # prefix, space-separated
            finalString = tagsToCopy.map(t => t.startsWith('#') ? t : '#' + t).join(' ');
        }

        // Provide visual feedback on the button text
        const copyBtnText   = document.getElementById('copy-text');
        const originalText  = copyBtnText.innerText;
        copyBtnText.innerText = 'Copied!';
        setTimeout(() => copyBtnText.innerText = originalText, 2000);

        // Primary clipboard method (modern browsers)
        try {
            await navigator.clipboard.writeText(finalString);
            window.showToast('📋 Tags Copied to Clipboard!');
        } catch (err) {
            // Fallback: hidden textarea + execCommand for older/WebView environments
            const textArea        = document.createElement('textarea');
            textArea.value        = finalString;
            textArea.style.cssText = 'position:fixed;left:-9999px;top:0;';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                window.showToast('📋 Tags Copied!');
            } catch (e) {
                window.showToast('❌ Copy Failed. Please copy manually.', true);
            }
            document.body.removeChild(textArea);
        }
    },

    /**
     * downloadTags()
     * Exports the current tag list as a plain-text (.txt) file.
     * File is named with the platform and a timestamp for easy organization.
     * YouTube uses comma-separated format; all others use space-separated.
     */
    downloadTags: function() {
        if (this.currentTags.length === 0) return;

        const separator  = this.currentPlatform === 'youtube' ? ', ' : ' ';
        const txtContent = this.currentTags.map(t => t.text).join(separator);
        const blob       = new Blob([txtContent], { type: 'text/plain' });
        const a          = document.createElement('a');
        a.href           = URL.createObjectURL(blob);
        a.download       = `UltraTag_${this.currentPlatform}_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.showToast('💾 Saved to Device');
    },

    /**
     * shuffleTags()
     * Randomizes the order of `this.currentTags` using a Fisher-Yates-style
     * sort and re-renders them. This is the "Remix" feature — useful for
     * creators who upload multiple videos on the same topic and want slight
     * variation in tag ordering to avoid spam detection.
     */
    shuffleTags: function() {
        this.currentTags.sort(() => Math.random() - 0.5);
        this.renderTags();
        window.showToast('🔀 Tags Shuffled');
    },

    /**
     * resetApp()
     * Clears the keyword input, resets the output box to the placeholder
     * state, hides the action bar, and resets the character counter.
     * Does NOT clear the search history (history persists in localStorage).
     */
    resetApp: function() {
        document.getElementById('keyword').value = '';

        const output     = document.getElementById('output');
        output.innerHTML = `
            <div class="utg-placeholder">
                <i class="fa-solid fa-fingerprint"></i>
                <span>Ready for new task</span>
            </div>`;

        document.getElementById('tools-bar').classList.add('hidden');

        const counter = document.getElementById('char-counter');
        if (counter) counter.style.display = 'none';
    },


    // =========================================================================
    // [SECTION 10: HISTORY SYSTEM]
    // =========================================================================

    /**
     * addToHistory()
     * Saves a keyword to the localStorage 'tagHistory' array.
     * - Deduplicates by removing existing occurrences of the same keyword.
     * - Inserts the new entry at position 0 (most recent first).
     * - Enforces a maximum of 5 entries (oldest dropped on overflow).
     * - Calls loadHistory() to immediately refresh the UI.
     *
     * @param {string} keyword - The keyword string to persist.
     */
    addToHistory: function(keyword) {
        let history = JSON.parse(localStorage.getItem('tagHistory') || '[]');
        // Remove duplicates of this keyword
        history     = history.filter(h => h !== keyword);
        // Prepend the new entry
        history.unshift(keyword);
        // Trim to max 5 entries
        if (history.length > 5) history.pop();
        localStorage.setItem('tagHistory', JSON.stringify(history));
        this.loadHistory();
    },

    /**
     * loadHistory()
     * Reads the localStorage 'tagHistory' array and renders each entry
     * as a `.history-chip` inside the `#history-container` div.
     * Each chip calls `rerunHistory()` on click to instantly regenerate
     * tags for that keyword.
     * Clears the container if history is empty.
     */
    loadHistory: function() {
        const container = document.getElementById('history-container');
        if (!container) return;

        const history = JSON.parse(localStorage.getItem('tagHistory') || '[]');
        if (history.length === 0) {
            container.innerHTML = '';
            return;
        }

        // Build the history chips HTML
        let html = `
            <div style="width:100%;text-align:center;font-size:11px;color:var(--text-muted);margin-bottom:8px;margin-top:12px;">Recent:</div>
            <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">`;

        history.forEach(h => {
            html += `<div class="history-chip" onclick="rerunHistory('${h}')">
                        <i class="fa-solid fa-clock-rotate-left"></i>${h}
                     </div>`;
        });
        html += '</div>';

        container.innerHTML = html;
    }

}; // END UltraTag object


// =============================================================================
// [GLOBAL EXPORTS]
// These window-level bindings allow HTML inline onClick attributes to call
// UltraTag methods without exposing the full object to the global scope.
// =============================================================================

/** Switches the active social platform and updates UI. */
window.switchPlatform = (p, b) => UltraTag.switchPlatform(p, b);

/** Toggles a filter chip on/off (viral, niche, bangla). */
window.toggleFilter   = (b, t)  => UltraTag.toggleFilter(b, t);

/** Toggles the YouTube comma-separator chip. */
window.toggleSeparator = (b)    => UltraTag.toggleSeparator(b);

/** Triggers the full tag generation pipeline. */
window.processTags    = ()       => UltraTag.processTags();

/** Handles Enter key press in the keyword input field. */
window.handleEnter    = (e)      => { if (e.key === 'Enter') UltraTag.processTags(); };

/** Copies selected or all tags to the clipboard. */
window.copySelectedOrAll = ()    => UltraTag.copySelectedOrAll();

/** Downloads the current tags as a .txt file. */
window.downloadTags   = ()       => UltraTag.downloadTags();

/** Shuffles the current tag list and re-renders (Remix feature). */
window.shuffleTags    = ()       => UltraTag.shuffleTags();

/** Resets the app to its initial empty state. */
window.resetApp       = ()       => UltraTag.resetApp();

/** Loads a history entry back into the input and regenerates. */
window.rerunHistory   = (v)      => {
    document.getElementById('keyword').value = v;
    UltraTag.processTags();
};

/** Toggles between dark and light mode themes. */
window.toggleTheme    = ()       => UltraTag.toggleTheme();


// =============================================================================
// [APP BOOTSTRAP]
// Initializes the UltraTag engine. Must be called after all exports are set.
// =============================================================================
UltraTag.init();
