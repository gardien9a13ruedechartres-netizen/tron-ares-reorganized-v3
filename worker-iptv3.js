const LIVEWATCH_ORIGIN = 'https://livewatch.top';
const LOVETIER_ORIGIN = 'https://deviantart.lovetier.bz';
const LOVETIER_PLAYER_ORIGIN = 'https://lovetier.bz';
const LOVETIER_WORKER_ORIGIN = 'https://tron-ares-iptv.victor-salema-53d.workers.dev';
const ENGINE_WORKER_ORIGIN = 'https://tron-ares-engine.victor-salema-53d.workers.dev';
const CLOUDING_ORIGIN = 'https://clouding.wideiptv.top';
const CLOUDING_PLAYER_ORIGIN = 'https://popcdn.day';
const PROXY_PATH = '/api/iptv/proxy';
const SOURCE_CACHE_TTL_MS = 120000;
const SOURCE_TEST_TIMEOUT_MS = 5000;
const sourceCache = new Map();
const LOVETIER_ALLOWED_PATHS = [
  '/BTV1/',
  '/SPT1/',
  '/SPT5/',
  '/CANALPLFR/',
  '/M6FR/',
  '/TF1FR/'
];
const CLOUDING_ALLOWED_PATHS = [
  '/CMTVPT/'
];

function legacyLovetierFallback(channelKey, label, lovetierChannel = channelKey.toUpperCase()) {
  return {
    id: `legacy-lovetier-${channelKey}`,
    name: `${label} Lovetier worker`,
    quality: null,
    source: 'lovetier',
    lovetierChannel
  };
}

function engineCloudingFallback(channelKey, label) {
  return {
    id: `legacy-clouding-${channelKey}`,
    name: `${label} Clouding worker`,
    quality: null,
    source: 'clouding',
    cloudingChannel: channelKey.toUpperCase()
  };
}

const LIVE_CHANNELS = new Map([
    ["tf1", { search: "TF1", exact: "TF1", country: "France", prefer: [null, "HD", "FHD"], sourcePrefer: ["satellite", "basic", "cable"], staticFirst: true, fallbackIds: [
    { id: "2913521200ae11151a1fc4-b5746bd2522e5c", name: "TF1", quality: null, source: "satellite" },
    { id: "1334669376bf508b8ed995-e1dc32893923cf", name: "TF1", quality: "FHD", source: "basic" } 
  ], staticFallbacks: [
    legacyLovetierFallback('tf1fr', 'TF1', 'TF1FR')
  ] }], 
  ['tf1sf', { search: 'TF1 SERIES & FILM', exact: 'TF1 SERIES & FILM', country: 'France', prefer: [null, 'HD', 'FHD'], sourcePrefer: ['satellite', 'cable', 'basic'], fallbackIds: [
    { id: '1760063888f6e9e21d8039-e1c647aa24dff8', name: 'TF1 SERIES & FILM', quality: null, source: 'satellite' },
    { id: '3049436856cd6a1575450a-d6ab2a40a54f7a', name: 'TF1 SERIES & FILM', quality: 'HD', source: 'satellite' }
  ] }],
  ['canal-plus', { search: 'CANAL+', exact: 'CANAL+', country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: '1839597702d549646f5393-2ac8f134e5cc3d', name: 'CANAL+', quality: null, source: 'cable' },
    { id: '6981957d8c5d6ef6ebe-00e248dcf7e873', name: 'CANAL+', quality: null, source: 'satellite' },
    { id: '298747715234a3a02669b8-699fafb82ad92d', name: 'CANAL+', quality: 'FHD', source: 'basic' },
    { id: '1860727909951701e97ea9-0552c051c6ab52', name: 'CANAL+', quality: 'HD', source: 'basic' },
    { id: '2421698062be5948a928f5-92450af7cf51c2', name: 'CANAL+', quality: '4K', source: 'basic' }
  ], staticFallbacks: [
    legacyLovetierFallback('canalplfr', 'CANAL+', 'CANALPLFR')
  ] }],
  ['canal-gr-ecran', { search: 'CANAL+ GRAND ECRAN', exact: 'CANAL+ GRAND ECRAN', country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: '25747471736b92892116f8-9e6e1088c67bdc', name: 'CANAL+ GRAND ECRAN', quality: null, source: 'cable' },
    { id: '25481898009fc4dd96f118-ebf0455ad2d869', name: 'CANAL+ GRAND ECRAN', quality: 'FHD', source: 'satellite' },
    { id: '764514828841cf1a946e8-a890035e372e41', name: 'CANAL+ GRAND ECRAN', quality: 'FHD', source: 'basic' },
    { id: '13730112351c691b47ed3b-da2c3b2aa7a4bb', name: 'CANAL+ GRAND ECRAN', quality: 'HD', source: 'basic' }
  ] }],
  ['canal-cinema', { search: 'CANAL+ CINEMA', exact: 'CANAL+ CINEMA', country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: '3980730104297e5d74da47-ae5ab89e27534a', name: 'CANAL+ CINEMA', quality: null, source: 'cable' },
    { id: '7815381974235226e525c-08b89a15623fb6', name: 'CANAL+ CINEMA', quality: null, source: 'satellite' },
    { id: '2898387495718e66ec3be-c854d47617c539', name: 'CANAL+ CINEMA', quality: 'FHD', source: 'satellite' },
    { id: '9740778764179b9c92456-b9dbab0a86d0a4', name: 'CANAL+ CINEMA', quality: 'HD', source: 'satellite' }
  ] }],
  ['canal-series', { search: 'CANAL+ SERIES', exact: 'CANAL+ SERIES', country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: '907568283b0bf51903416-605791705e0c48', name: 'CANAL+ SERIES', quality: null, source: 'cable' },
    { id: '412353586256ea59f8b7b5-48ff83e119e784', name: 'CANAL+ SERIES', quality: null, source: 'satellite' },
    { id: '2141653939fb56edcf97da-a136854c58391a', name: 'CANAL+ SERIES', quality: 'FHD', source: 'satellite' },
    { id: '2354397782686b0f84677f-21272264449cba', name: 'CANAL+ SERIES', quality: 'FHD', source: 'basic' },
    { id: '296255235587d472eb18c8-a46767322a9b14', name: 'CANAL+ SERIES', quality: 'HD', source: 'satellite' },
    { id: '31229880095478070434b1-49a1fae602e682', name: 'CANAL+ SERIES', quality: '4K', source: 'basic' }
  ] }],
  ['6ter', { search: '6TER', exact: '6TER', country: 'France', prefer: ['FHD', 'HD', null] }],
  ['cstar', { search: 'C STAR', exact: 'C STAR', country: 'France', prefer: ['FHD', 'HD', null], fallbackIds: [
    { id: '3480426017c3f2b3e10a98-4eb0ab5a31ab6c', name: 'C STAR', quality: 'FHD', source: 'satellite' },
    { id: '3166346130b6b8b30bb9d2-eda28228a50465', name: 'C STAR', quality: null, source: 'cable' }
  ] }],
  ['w9', { search: 'W9', exact: 'W9', country: 'France', prefer: ['HD', 'FHD', null] }],
  ['cmtv', { search: 'CM TV', exact: 'CM TV', country: 'Portugal', prefer: [null, 'HD', 'FHD'], sourcePrefer: ['cable', 'basic'], livewatchRetries: 3, livewatchRetryDelayMs: 700, fallbackIds: [
    { id: '384601660517fa3552a29f-6816b5893e5bcc', name: 'CM TV', quality: null, source: 'basic' },
    { id: '805844173b05e1a81e31d-579768661fe265', name: 'CM TV', quality: null, source: 'cable' }
  ], staticFallbacks: [
    engineCloudingFallback('cmtvpt', 'CMTV')
  ] }],
  ['btv', { search: 'BTV', exact: 'BTV', country: 'Portugal', prefer: ['HD', null, 'FHD'], fallbackIds: [
    { id: '419434034c29c7a3c7b07-c30c1297e6e5ce', name: 'BTV', quality: 'HD', source: 'basic' },
    { id: '2434383426cedb9a7f8182-853d5b7284c58b', name: 'BTV (BENFICA)', quality: null, source: 'cable' }
  ], staticFallbacks: [
    legacyLovetierFallback('btv', 'BTV', 'BTV1')
  ] }],
  ['sport-tv-1', { search: 'SPORT TV 1', exact: 'SPORT TV 1', country: 'Portugal', prefer: ['HD', null, 'FHD'], fallbackIds: [
    { id: '3966581533812bd3be6382-2dee5e113ca360', name: 'SPORT TV 1', quality: 'HD', source: 'basic' },
    { id: '211283081051caac7287c4-b0c19770b7972b', name: 'SPORT TV 1 (BACKUP)', quality: 'HD', source: 'basic' },
    { id: '10004270647c8377fd8313-31e3d5c4614739', name: 'SPORT TV 1', quality: null, source: 'basic' },
    { id: '34289402226976c68b9b9e-bf2069844244ff', name: 'SPORT TV 1', quality: null, source: 'cable' },
    { id: '14386289065b08d49bfc3e-61a6d716bcbe83', name: 'SPORT TV 1 (BACKUP)', quality: null, source: 'basic' }
  ], staticFallbacks: [
    legacyLovetierFallback('sport-tv-1', 'SPORT TV 1', 'SPT1')
  ] }],
  ['sport-tv-5', { search: 'SPORT TV 5', exact: 'SPORT TV 5', country: 'Portugal', prefer: [null, 'HD', 'FHD'], excludeIds: ['34583288246e0a0ec6fc0f-7f7f9c6e6c2f38'], fallbackIds: [
    { id: '12763267051751832c99d9-e96250d7d887f8', name: 'SPORT TV 5 (BACKUP)', quality: null, source: 'basic' },
    { id: '9711041268146231bc411-77fb597e2397df', name: 'SPORT TV 5', quality: null, source: 'cable' }
  ], staticFallbacks: [
    legacyLovetierFallback('sport-tv-5', 'SPORT TV 5', 'SPT5')
  ] }],
  ['disney-pixar', { search: 'DISNEY+ PIXAR', exact: 'DISNEY+ PIXAR', country: 'Portugal', prefer: [null, 'HD', 'FHD'], fallbackIds: [
    { id: '1616464273e04bb68a8a1c-ed3fcb510db31f', name: 'DISNEY+ PIXAR', quality: null, source: 'cable' }
  ] }],
  ['canal-panda', { search: 'CANAL PANDA', exact: 'CANAL PANDA', country: 'Portugal', prefer: [null, 'HD', 'FHD'], fallbackIds: [
    { id: '26958390437906a5f4ba97-d22b5eb462d646', name: 'CANAL PANDA', quality: null, source: 'cable' },
    { id: '4002241315e5ee10f4b753-97c7a8325393c2', name: 'CANAL PANDA', quality: null, source: 'basic' }
  ] }],
  ['tv-globo', { search: 'GLOBO BRAZIL', exact: 'GLOBO BRAZIL', country: 'Portugal', prefer: [null, 'HD', 'FHD'], sourcePrefer: ['cable', 'basic'], fallbackIds: [
    { id: '4138844993f9f6ab3175df-991265815db62b', name: 'GLOBO BRAZIL', quality: null, source: 'cable' },
    { id: '3068526841d78e5d3c16ff-dc1695f8251824', name: 'TV GLOBO', quality: null, source: 'basic' },
    { id: '20994889228f6a91cba570-41e5862131242f', name: 'TV GLOBO NOW', quality: null, source: 'basic' }
  ] }],
  ["golf", { search: "GOLF+", exact: "GOLF+ CHANNEL", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "780950104a5cb52c94aa2-88d30a5c48d027", name: "GOLF+ CHANNEL", quality: null, source: "satellite" },
    { id: "28324561ced12307fdbb-735096274b0694", name: "GOLF+ CHANNEL", quality: "FHD", source: "satellite" }
  ] }],
  ["auto-moto", { search: "AUTO MOTO", exact: "AUTO MOTO", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "1110040958c161c4e38ce9-8d51147a271203", name: "AUTO MOTO", quality: "HD", source: "satellite" }
  ] }],
  ["l-equipe-fr", { search: "L EQUIPE", exact: "L EQUIPE", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "1064699189d6dd5dc4d422-856d62582d1513", name: "L EQUIPE", quality: null, source: "cable" },
    { id: "38373319428576fb860cef-802f251211ffb1", name: "L EQUIPE", quality: null, source: "satellite" },
    { id: "2241995657d1acf374577f-439b1c3988b027", name: "L EQUIPE", quality: null, source: "basic" }
  ] }],
  ["ocs-max", { search: "OCS MAX", exact: "OCS MAX", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "636734800c64cceb42cf-7325d09036ee4e", name: "OCS MAX", quality: null, source: "cable" },
    { id: "42064702927b26fcd04aa-894a8129a06e33", name: "OCS MAX", quality: null, source: "satellite" },
    { id: "2561627199a0669a101b1e-f9e6cde850e4ab", name: "OCS MAX", quality: "FHD", source: "satellite" },
    { id: "151053255430b682f860-71fa30e2ad1689", name: "OCS MAX", quality: "HD", source: "satellite" }
  ] }],
  ["warner-tv", { search: "WARNER TV", exact: "WARNER TV", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "30593609059ce1103aec2e-59f2068cdb0b85", name: "WARNER TV", quality: null, source: "cable" },
    { id: "2978100125aecff8327cf5-ec0eb76b33ec19", name: "WARNER TV", quality: null, source: "satellite" },
    { id: "48836462992d6cf6baccf-2dfa35b36b8332", name: "WARNER TV NEXT", quality: null, source: "cable" }
  ] }],
  ["cine-frisson", { search: "CINE+ FRISSON", exact: "CINE+ FRISSON", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "3654122461b46665c82b8f-2f4675d52df5dc", name: "CINE+ FRISSON", quality: null, source: "cable" }
  ] }],
  ["cine-emotion", { search: "CINE+ EMOTION", exact: "CINE+ EMOTION", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "7546769060ce35541f305-b64237317fb59f", name: "CINE+ EMOTION", quality: null, source: "cable" },
    { id: "4012587463c5d0adb0620e-d6461b78095980", name: "CINE+ EMOTION", quality: null, source: "satellite" },
    { id: "2737270354dc417dc353b0-3bb897e9f0e140", name: "CINE+ EMOTION", quality: "FHD", source: "satellite" },
    { id: "135614661597d2792a4429-800be2a83171eb", name: "CINE+ EMOTION", quality: "FHD", source: "basic" }
  ] }],
  ["cine-classic", { search: "CINE+ CLASSIC", exact: "CINE+ CLASSIC", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "826335846cd94062fe98-4fb202719f29f1", name: "CINE+ CLASSIC", quality: null, source: "cable" },
    { id: "3342642717ab7f2fad50a4-3c594b794f9dee", name: "CINE+ CLASSIC", quality: null, source: "satellite" },
    { id: "581219766ec0c08526620-4c53cd2db97ebc", name: "CINE+ CLASSIC", quality: "FHD", source: "satellite" },
    { id: "3677483481c601971abf79-b7fe08230b1502", name: "CINE+ CLASSIC", quality: "HD", source: "satellite" }
  ] }],
  ["cine-club", { search: "CINE+ CLUB", exact: "CINE+ CLUB", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "1800537483f21c95207e51-a7e1f948aac95f", name: "CINE+ CLUB", quality: null, source: "cable" },
    { id: "176726491979039c050819-b15b40089b122f", name: "CINE+ CLUB", quality: null, source: "satellite" },
    { id: "5870248549e97edf632cd-1ff1e3a667c107", name: "CINE+ CLUB", quality: "HD", source: "satellite" },
    { id: "26514025573f474a0abd81-740408c1c368cf", name: "CINE+ CLUB", quality: "FHD", source: "basic" }
  ] }],
  ["serie-club", { search: "SERIE CLUB", exact: "SERIE CLUB", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "1534887525bcb2cc0c943a-0f014dfb9a8451", name: "SERIE CLUB", quality: null, source: "cable" }
  ] }],
  ["tcm-cinema", { search: "TCM CINEMA", exact: "TCM CINEMA", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "2451805128d0f9045d041b-ed47dcec34444c", name: "TCM CINEMA", quality: null, source: "satellite" },
    { id: "3637294135d561d9540c1c-933813a71d3ece", name: "TCM CINEMA", quality: null, source: "basic" }
  ] }],
  ["disney-plus-fr", { search: "DISNEY+", exact: "DISNEY+", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['satellite', 'cable', 'basic'], fallbackIds: [
    { id: "23220966391db224d00af9-fe6a45e22b5077", name: "DISNEY+", quality: null, source: "satellite" }
  ] }],
  ["disney-junior", { search: "DISNEY JUNIOR", exact: "DISNEY JUNIOR", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "3351330853ba2b580d385f-08df3f69cbcec0", name: "DISNEY JUNIOR", quality: null, source: "satellite" },
    { id: "357894050d7f96e94e22f-7dea5cea101754", name: "DISNEY JUNIOR", quality: "FHD", source: "satellite" },
    { id: "1244883752934afb7348d0-710962f0dc7de6", name: "DISNEY JUNIOR", quality: null, source: "basic" },
    { id: "4039125784a8c6af55cefd-1089d3f4d65646", name: "DISNEY JUNIOR (BACKUP)", quality: null, source: "basic" }
  ] }],
  ["cartoon-network", { search: "CARTOON NETWORK", exact: "CARTOON NETWORK", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "278630331931d4f590a721-11a3e66f138ae4", name: "CARTOON NETWORK", quality: null, source: "cable" },
    { id: "2127297858581f62f0bf4c-eef3410f1d1bfb", name: "CARTOON NETWORK", quality: "FHD", source: "satellite" },
    { id: "3047805633546dcf9fb24b-e949024146d5d8", name: "CARTOON NETWORK", quality: null, source: "basic" },
    { id: "2078762115ee0894e1e157-adbd239d277f15", name: "CARTOON NETWORK", quality: "4K", source: "basic" }
  ] }],
  ["canal-j", { search: "CANAL J", exact: "CANAL J", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "85706364091e683ba1a33-5c832e172adad3", name: "CANAL J", quality: null, source: "cable" },
    { id: "24446412ebabf61b09ad-043d27d40d15b4", name: "CANAL J", quality: "FHD", source: "satellite" },
    { id: "3860888136d301b247640b-021aab3c4b6dfb", name: "CANAL J", quality: null, source: "basic" },
    { id: "6099304471232528ee2e1-4f07037b01a340", name: "CANAL J (BACKUP)", quality: null, source: "basic" }
  ] }],
  ["teletoon", { search: "TELETOON", exact: "TELETOON+", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "2382507077306dedae7ff3-e03c9b3620ee1a", name: "TELETOON+", quality: null, source: "cable" },
    { id: "231278062503478eaef59f-1363b3bc9b6a6e", name: "TELETOON+", quality: null, source: "satellite" },
    { id: "1143042553bb95572793be-4a7357659fbfc8", name: "TELETOON +1", quality: null, source: "cable" }
  ] }],
  ["mangas", { search: "MANGAS", exact: "MANGAS", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "139408412ba8e0ae7a800-af3111e493d466", name: "MANGAS", quality: null, source: "satellite" },
    { id: "3781018265a0de3a4a5f34-cb323ba5b11df7", name: "MANGAS", quality: null, source: "basic" },
    { id: "401237472a1e90e56167a-e5d148a48b2e03", name: "MANGAS", quality: "HD", source: "basic" }
  ] }],
  ["j-one", { search: "J-ONE", exact: "J-ONE", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "874035777bcae83ee8339-448ec8df936ca1", name: "J-ONE", quality: null, source: "basic" }
  ] }],
  ["tiji", { search: "TIJI", exact: "TIJI", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "381228029420ab3e3544f6-b7ace7d491d7aa", name: "TIJI", quality: "FHD", source: "satellite" },
    { id: "61014295140065dfc1ba9-42df2ea83b0598", name: "TIJI", quality: "HD", source: "satellite" },
    { id: "12869143765e4bc62e1bc-a831bfc016195f", name: "TIJI", quality: null, source: "basic" }
  ] }],
  ["nickelodeon", { search: "NICKELODEON", exact: "NICKELODEON", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "280381887053bd39b0c65f-f0abfafee5bc9c", name: "NICKELODEON", quality: null, source: "cable" },
    { id: "2881806872c3195b245695-8f25ba9085fc8e", name: "NICKELODEON", quality: null, source: "satellite" },
    { id: "2600378206c4151e6fe1dd-7e83c87ae047f4", name: "NICKELODEON JUNIOR", quality: null, source: "cable" },
    { id: "2786840044bbf88bfbe8f7-6c830fd8cea545", name: "NICKELODEON +1", quality: null, source: "cable" }
  ] }],
  ["boing", { search: "BOING", exact: "BOING", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "69130693e2582f2056fe-1367813e7d7947", name: "BOING", quality: null, source: "basic" }
  ] }],
  ["game-one", { search: "GAME ONE", exact: "GAME ONE", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "22141630554906bb2fc4a4-615863c6daad76", name: "GAME ONE", quality: null, source: "cable" },
    { id: "1479966396202ff806f8d8-cbf2e8251593f3", name: "GAME ONE", quality: null, source: "satellite" }
  ] }],
  ["toonami", { search: "TOONAMI", exact: "TOONAMI", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "4132905048a27f69176a77-f271550b92fa28", name: "TOONAMI", quality: null, source: "cable" }
  ] }],
  ["toute-l-histoire", { search: "TOUTE L'HISTOIRE", exact: "TOUTE L HISTOIRE", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "22335450950012aecee2ea-0f5f79eca55d8f", name: "TOUTE L HISTOIRE", quality: null, source: "satellite" },
    { id: "31946318574d1657fbd437-c09eeedf8b9fdb", name: "TOUTE L HISTOIRE", quality: "HD", source: "satellite" }
  ] }],
  ["nat-geo", { search: "NAT GEO", exact: "NAT GEO", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "13411697827c093b9217a6-d306fbe39a12c6", name: "NAT GEO", quality: null, source: "cable" },
    { id: "2662111844aff3a550d3f7-7ba789afe7e146", name: "NAT GEO", quality: "FHD", source: "satellite" }
  ] }],
  ["nat-geo-wild", { search: "NAT GEO WILD", exact: "NAT GEO WILD", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "4163250572cb7f669550a4-3d0d5a84418865", name: "NAT GEO WILD", quality: null, source: "cable" },
    { id: "12578909822641fbc02dc3-c31972024bfa81", name: "NAT GEO WILD", quality: null, source: "satellite" },
    { id: "295899358126aff7725d18-fdee8f20c90503", name: "NAT GEO WILD", quality: "FHD", source: "satellite" },
    { id: "4087509269bc6b8e5313a4-bcff710cb1d8ee", name: "NAT GEO WILD", quality: "HD", source: "satellite" }
  ] }],
  ["discovery-science", { search: "DISCOVERY SCIENCE", exact: "DISCOVERY SCIENCE", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "27011456832d97fd3f96b1-a853c618061161", name: "DISCOVERY SCIENCE", quality: null, source: "satellite" },
    { id: "13916241181642741e7fb7-fdaacb46707245", name: "DISCOVERY SCIENCE", quality: null, source: "basic" }
  ] }],
  ["ushuaia-tv", { search: "USHUAIA", exact: "USHUAIA", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['satellite', 'basic', 'cable'], fallbackIds: [
    { id: "4274246496cae3eb6b9282-fd0a6c4baf6755", name: "USHUAIA", quality: null, source: "satellite" },
    { id: "7377560460dce594183e5-ad52d57e270076", name: "USHUAIA", quality: "FHD", source: "satellite" },
    { id: "814473941476083b06ccb-aa495a509760c4", name: "USHUAIA", quality: "HD", source: "satellite" },
    { id: "30343651343100cf58d048-49ae141343babb", name: "USHUAIA TV", quality: "HD", source: "basic" }
  ] }],
  ["science-vie", { search: "SCIENCE & VIE", exact: "SCIENCE & VIE", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "38619424749a7f941cb30-54abd9ba33e71b", name: "SCIENCE & VIE", quality: null, source: "satellite" },
    { id: "152357533f67555e62908-aa5ee95724bef2", name: "SCIENCE & VIE TV", quality: null, source: "cable" }
  ] }],
  ["planete-crime", { search: "PLANETE+ CRIME", exact: "PLANETE+ CRIME", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "18698414995fd862423d6-6f3ef08a42e1bc", name: "PLANETE+ CRIME", quality: null, source: "satellite" },
    { id: "3552349294e8f1f6a1d376-8e3ce7fd7b5016", name: "PLANETE+ CRIME", quality: "HD", source: "satellite" }
  ] }],
  ["animaux", { search: "ANIMAUX", exact: "ANIMAUX", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "23092519062e4569443ea7-6ca1f439632427", name: "ANIMAUX", quality: null, source: "cable" },
    { id: "2474469311465ad21db7be-9cded0c55031b8", name: "ANIMAUX", quality: null, source: "satellite" },
    { id: "155306235421d782ab66e0-d7ecc20b2eb620", name: "ANIMAUX", quality: null, source: "basic" }
  ] }],
  ["rmc-decouverte-2", { search: "RMC DECOUVERTE", exact: "RMC DECOUVERTE", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "26066150769be8b83ee804-af017e71349872", name: "RMC DECOUVERTE", quality: null, source: "satellite" }
  ] }],
  ["investigation-discovery", { search: "INVESTIGATION DISCOVERY", exact: "INVESTIGATION DISCOVERY", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "286307272239f45a9230cb-3b4db1b78f26f3", name: "INVESTIGATION DISCOVERY", quality: null, source: "cable" }
  ] }],
  ["chasse-peche", { search: "CHASSE & PECHE", exact: "CHASSE & PECHE", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "30277092126bc746a51a20-d17faee3c160af", name: "CHASSE & PECHE", quality: null, source: "cable" },
    { id: "2674834370a1cac4b77989-e6c20205a967e8", name: "CHASSE & PECHE", quality: null, source: "satellite" }
  ] }],
  ["crime-district", { search: "CRIME DISTRICT", exact: "CRIME DISTRICT", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "233249952949b217798c9e-4beb79d74324a1", name: "CRIME DISTRICT", quality: null, source: "cable" },
    { id: "26863556070010417e6d9d-8989a74e7c7b85", name: "CRIME DISTRICT", quality: null, source: "satellite" }
  ] }],
  ["mcm", { search: "MCM", exact: "MCM", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "855739216dd3b63b126bc-2ebedcfec45012", name: "MCM", quality: null, source: "satellite" },
    { id: "33400096800b79d7bb9d9-5ca9814ebe0f2f", name: "MCM", quality: "HD", source: "satellite" },
    { id: "8696880859ab59a847a37-1acc146d4bb3d4", name: "MCM POP", quality: null, source: "cable" },
    { id: "33487111745e397d403417-d2c67332238dbd", name: "MCM TOP", quality: null, source: "cable" }
  ] }],
  ["m6-music", { search: "M6 MUSIC", exact: "M6 MUSIC", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "4154285296f902b73b0d28-87a81f8557de0d", name: "M6 MUSIC", quality: null, source: "cable" },
    { id: "7435919714613b22a77d1-a6d54f4daab9d6", name: "M6 MUSIC", quality: null, source: "satellite" },
    { id: "285936085861281a838c2f-9ae29e33139ec9", name: "M6 MUSIC", quality: "HD", source: "basic" },
    { id: "38871521898e03f2cfd86d-baee3d9fb1aa96", name: "M6 MUSIC (BACKUP)", quality: null, source: "satellite" }
  ] }],
  ["mtv", { search: "MTV", exact: "MTV", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "987897824424746e378ce-28029f74c62f46", name: "MTV", quality: null, source: "satellite" },
    { id: "131724335525762423a972-63da2e4425c6be", name: "MTV", quality: "FHD", source: "satellite" },
    { id: "808220806e13753a10c7c-3a533f91f48d29", name: "MTV FRANCE", quality: null, source: "cable" },
    { id: "84149442655bf9ba0d47b-28fa7a18187594", name: "MTV FRANCE", quality: null, source: "satellite" }
  ] }],
  ["mtv-hits", { search: "MTV HITS", exact: "MTV HITS", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "2301201739cd8e74158e09-96f25fb704ee3b", name: "MTV HITS", quality: null, source: "satellite" },
    { id: "199610210545959c828fd6-c5f21ab7eb0770", name: "MTV HITS SD", quality: null, source: "basic" }
  ] }],
  ["nrj-hits", { search: "NRJ HITS", exact: "NRJ HITS", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "730920094046c7f17c984-7c2374b1edf467", name: "NRJ HITS", quality: null, source: "satellite" },
    { id: "3639203183127ef9073e5d-80087061989ddf", name: "NRJ HITS", quality: "HD", source: "basic" }
  ] }],
  ["bfm-business", { search: "BFM BUSINESS", exact: "BFM BUSINESS", country: 'France', prefer: [null, 'FHD', 'HD', '4K'], sourcePrefer: ['cable', 'satellite', 'basic'], fallbackIds: [
    { id: "1945266328e8e437e6162d-e36c345412b4b4", name: "BFM BUSINESS", quality: null, source: "cable" }
  ] }],
  ['m6', { search: 'M6', exact: 'M6', country: 'France', prefer: ['FHD', 'HD', null], staticFallbacks: [
    legacyLovetierFallback('m6fr', 'M6', 'M6FR')
  ] }]
]);

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Accept, Content-Type',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, X-Ares-Channel, X-Ares-Source-Id, X-Ares-Source-Type, X-Ares-Source-Quality, X-Ares-Detection'
  };
}

function livewatchHeaders(accept = '*/*') {
  return {
    Accept: accept,
    Referer: `${LIVEWATCH_ORIGIN}/`,
    'User-Agent': 'Mozilla/5.0'
  };
}

function upstreamHeaders(url, accept = '*/*') {
  const headers = {
    Accept: accept,
    'User-Agent': 'Mozilla/5.0'
  };
  if (url.origin === LIVEWATCH_ORIGIN) headers.Referer = `${LIVEWATCH_ORIGIN}/`;
  if (url.origin === LOVETIER_ORIGIN) headers.Referer = `${LOVETIER_ORIGIN}/`;
  return headers;
}

function isAllowedLivewatchUrl(url) {
  return url.origin === LIVEWATCH_ORIGIN &&
    url.pathname === '/api/hls' &&
    url.searchParams.has('t') &&
    !url.username &&
    !url.password;
}

function isAllowedLovetierUrl(url) {
  return url.origin === LOVETIER_ORIGIN &&
    LOVETIER_ALLOWED_PATHS.some(path => url.pathname.toLowerCase().startsWith(path.toLowerCase())) &&
    !url.username &&
    !url.password;
}

function isAllowedCloudingUrl(url) {
  return url.origin === CLOUDING_ORIGIN &&
    CLOUDING_ALLOWED_PATHS.some(path => url.pathname.toLowerCase().startsWith(path.toLowerCase())) &&
    !url.username &&
    !url.password;
}

function isAllowedProxyUrl(url) {
  return isAllowedLivewatchUrl(url) || isAllowedLovetierUrl(url) || isAllowedCloudingUrl(url);
}

function isAllowedStaticFallbackUrl(url) {
  if (url.origin === LOVETIER_WORKER_ORIGIN) {
    return /^\/api\/iptv\/live\/[a-z0-9-]+\/master\.m3u8$/i.test(url.pathname) &&
      !url.username &&
      !url.password;
  }

  if (url.origin === ENGINE_WORKER_ORIGIN) {
    return /^\/api\/worker-live\/[a-z0-9-]+\/master\.m3u8$/i.test(url.pathname) &&
      !url.username &&
      !url.password;
  }

  return isAllowedProxyUrl(url);
}

function makeProxyUrl(value, baseUrl, publicOrigin) {
  try {
    const upstream = new URL(value, baseUrl);
    if (!isAllowedProxyUrl(upstream)) return value;
    return `${publicOrigin}${PROXY_PATH}?url=${encodeURIComponent(upstream.href)}`;
  } catch (_) {
    return value;
  }
}

function rewritePlaylist(text, upstreamUrl, publicOrigin) {
  return text.split(/\r?\n/).map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (!trimmed.startsWith('#')) {
      return makeProxyUrl(trimmed, upstreamUrl, publicOrigin);
    }

    return line
      .replace(/URI="([^"]+)"/g, (match, value) => `URI="${makeProxyUrl(value, upstreamUrl, publicOrigin)}"`)
      .replace(/URI='([^']+)'/g, (match, value) => `URI='${makeProxyUrl(value, upstreamUrl, publicOrigin)}'`);
  }).join('\n');
}

function hlsContentType(pathname, fallback) {
  const type = String(fallback || '').split(';')[0].trim().toLowerCase();
  if (type.includes('mpegurl') || type.includes('x-mpegurl')) return 'application/vnd.apple.mpegurl';
  if (type.includes('mp2t')) return 'video/mp2t';
  if (type.includes('iso.segment')) return 'video/iso.segment';
  if (type.includes('mp4')) return 'video/mp4';
  if (type.includes('aac')) return 'audio/aac';

  const lower = pathname.toLowerCase();
  if (lower.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (lower.endsWith('.ts')) return 'video/mp2t';
  if (lower.endsWith('.m4s')) return 'video/iso.segment';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.aac')) return 'audio/aac';
  return fallback || 'application/octet-stream';
}

function sourcePreferenceScore(source, channel) {
  if (Array.isArray(channel?.sourcePrefer)) {
    const index = channel.sourcePrefer.indexOf(String(source || '').toLowerCase());
    return index >= 0 ? (30 - index * 10) : 0;
  }

  const normalized = String(source || '').toLowerCase();
  if (normalized === 'basic') return 20;
  if (normalized === 'satellite') return 10;
  if (normalized === 'cable') return 5;
  return 0;
}

function qualityRank(channel, item) {
  const quality = item?.quality ?? null;
  const preferred = channel.prefer.indexOf(quality);
  const qualityScore = preferred >= 0 ? (100 - preferred) : 0;
  return qualityScore + sourcePreferenceScore(item?.source, channel);
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchTextWithTimeout(url, options = {}, timeoutMs = SOURCE_TEST_TIMEOUT_MS) {
  const timeout = timeoutSignal(timeoutMs);
  try {
    return await fetch(url, { ...options, signal: timeout.signal });
  } finally {
    timeout.cancel();
  }
}

async function findChannelMatches(channel, skipIds = new Set()) {
  const apiUrl = new URL('/api/channels', LIVEWATCH_ORIGIN);
  apiUrl.searchParams.set('country', channel.country);
  apiUrl.searchParams.set('limit', '20');
  apiUrl.searchParams.set('search', channel.search);

  const response = await fetch(apiUrl, {
    headers: livewatchHeaders('application/json,text/plain,*/*'),
    redirect: 'follow'
  });
  if (!response.ok) throw new Error(`channels ${response.status}`);

  const data = await response.json();
  const excluded = new Set(channel.excludeIds || []);
  const matches = (data.channels || [])
    .filter(item => String(item.name || '').toLowerCase() === channel.exact.toLowerCase())
    .filter(item => !excluded.has(String(item.id || '')))
    .filter(item => !skipIds.has(String(item.id || '')))
    .sort((a, b) => qualityRank(channel, b) - qualityRank(channel, a));

  if (Array.isArray(channel.fallbackIds)) {
    const seen = new Set(matches.map(item => String(item.id || '')));
    const fallbacks = channel.fallbackIds
      .filter(item => !skipIds.has(String(item.id || '')))
      .filter(item => {
        const id = String(item.id || '');
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    if (matches.length || fallbacks.length) {
      return [...matches, ...fallbacks]
      .sort((a, b) => qualityRank(channel, b) - qualityRank(channel, a));
    }
  }

  if (!matches.length) throw new Error('channel not found');
  return matches;
}

function prioritizeCandidates(channelKey, matches, skipIds = new Set()) {
  const cached = sourceCache.get(channelKey);
  if (!cached || cached.expiresAt <= Date.now() || skipIds.has(cached.id)) return matches;

  return [...matches].sort((a, b) => {
    if (a.id === cached.id) return -1;
    if (b.id === cached.id) return 1;
    return 0;
  });
}

async function resolveCandidate(candidate) {
  const streamUrl = new URL(`/api/stream/${encodeURIComponent(candidate.id)}`, LIVEWATCH_ORIGIN);
  const streamResponse = await fetchTextWithTimeout(streamUrl, {
    headers: livewatchHeaders('application/json,text/plain,*/*'),
    redirect: 'follow'
  });
  if (!streamResponse.ok) throw new Error(`stream ${streamResponse.status}`);

  const streamData = await streamResponse.json();
  const upstreamUrl = new URL(streamData.proxy_url, LIVEWATCH_ORIGIN);
  if (!isAllowedLivewatchUrl(upstreamUrl)) throw new Error('dynamic stream URL refused');

  const startedAt = Date.now();
  const master = await fetchTextWithTimeout(upstreamUrl, {
    headers: livewatchHeaders('application/vnd.apple.mpegurl,application/x-mpegURL,*/*'),
    redirect: 'follow'
  });
  const latencyMs = Date.now() - startedAt;
  const masterText = await master.text();
  if (!master.ok || !masterText.trimStart().startsWith('#EXTM3U')) {
    throw new Error(`master ${master.status}`);
  }

  return { candidate, upstreamUrl, masterText, latencyMs };
}

async function resolveStaticFallback(fallback) {
  if (fallback.lovetierChannel) return resolveLovetierFallback(fallback);
  if (fallback.cloudingChannel) return resolveCloudingFallback(fallback);

  const upstreamUrl = new URL(fallback.url);
  if (!isAllowedStaticFallbackUrl(upstreamUrl)) throw new Error('static fallback URL refused');

  const startedAt = Date.now();
  const master = await fetchTextWithTimeout(upstreamUrl, {
    headers: upstreamHeaders(upstreamUrl, 'application/vnd.apple.mpegurl,application/x-mpegURL,*/*'),
    redirect: 'follow'
  });
  const latencyMs = Date.now() - startedAt;
  const masterText = await master.text();
  if (!master.ok || !masterText.trimStart().startsWith('#EXTM3U')) {
    throw new Error(`static master ${master.status}`);
  }

  return { candidate: fallback, upstreamUrl, masterText, latencyMs };
}

async function resolveCloudingFallback(fallback) {
  const channel = String(fallback.cloudingChannel || '');
  if (!channel || !/^[a-z0-9-]+$/i.test(channel)) throw new Error('clouding channel refused');

  const sourceUrl = new URL('/player.php', CLOUDING_PLAYER_ORIGIN);
  sourceUrl.searchParams.set('stream', channel);
  const source = await fetchTextWithTimeout(sourceUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0'
    },
    redirect: 'follow'
  });
  if (!source.ok) throw new Error(`clouding source ${source.status}`);

  const sourceHtml = await source.text();
  const pattern = new RegExp(
    `https://clouding\\.wideiptv\\.top/${channel}/embed\\.html\\?token=([^"'\\s<>&]+)`,
    'i'
  );
  const match = sourceHtml.match(pattern);
  if (!match || !match[1]) throw new Error('clouding token unavailable');

  const upstreamUrl = new URL(`${CLOUDING_ORIGIN}/${channel}/index.fmp4.m3u8`);
  upstreamUrl.searchParams.set('token', match[1]);
  if (!isAllowedCloudingUrl(upstreamUrl)) throw new Error('clouding stream URL refused');

  const startedAt = Date.now();
  const master = await fetchTextWithTimeout(upstreamUrl, {
    headers: upstreamHeaders(upstreamUrl, 'application/vnd.apple.mpegurl,application/x-mpegURL,*/*'),
    redirect: 'follow'
  });
  const latencyMs = Date.now() - startedAt;
  const masterText = await master.text();
  if (!master.ok || !masterText.trimStart().startsWith('#EXTM3U')) {
    throw new Error(`clouding master ${master.status}`);
  }

  return { candidate: fallback, upstreamUrl, masterText, latencyMs };
}

async function resolveLovetierFallback(fallback) {
  const channel = String(fallback.lovetierChannel || '');
  if (!channel || !/^[a-z0-9-]+$/i.test(channel)) throw new Error('lovetier channel refused');

  const sourceUrl = new URL(`/player/${channel}`, LOVETIER_PLAYER_ORIGIN);
  const source = await fetchTextWithTimeout(sourceUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0'
    },
    redirect: 'follow'
  });
  if (!source.ok) throw new Error(`lovetier source ${source.status}`);

  const sourceHtml = await source.text();
  const match = sourceHtml.match(/streamUrl:\s*"([^"]+)"/i);
  if (!match || !match[1]) throw new Error('lovetier stream URL unavailable');

  const upstreamUrl = new URL(
    match[1]
      .replace(/\\\//g, '/')
      .replace(/\\u0026/gi, '&')
  );
  const expectedPath = `/${channel}/index.m3u8`.toLowerCase();
  if (
    !isAllowedLovetierUrl(upstreamUrl) ||
    upstreamUrl.pathname.toLowerCase() !== expectedPath ||
    !upstreamUrl.searchParams.has('token')
  ) {
    throw new Error('lovetier stream URL refused');
  }

  const startedAt = Date.now();
  const master = await fetchTextWithTimeout(upstreamUrl, {
    headers: upstreamHeaders(upstreamUrl, 'application/vnd.apple.mpegurl,application/x-mpegURL,*/*'),
    redirect: 'follow'
  });
  const latencyMs = Date.now() - startedAt;
  const masterText = await master.text();
  if (!master.ok || !masterText.trimStart().startsWith('#EXTM3U')) {
    throw new Error(`lovetier master ${master.status}`);
  }

  return { candidate: fallback, upstreamUrl, masterText, latencyMs };
}

function parseSkipIds(requestUrl) {
  return new Set(String(requestUrl.searchParams.get('skip') || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean));
}

async function selectWorkingSource(channelKey, channel, skipIds = new Set()) {
  let matches = [];
  const failures = [];

  const tryStaticFallbacks = async (detectionLabel) => {
    for (const fallback of channel.staticFallbacks || []) {
      if (skipIds.has(String(fallback.id || ''))) continue;
      try {
        const resolved = await resolveStaticFallback(fallback);
        sourceCache.delete(channelKey);
        return {
          ...resolved,
          detection: failures.length ? `${detectionLabel}-after-${failures.length}-failure` : detectionLabel
        };
      } catch (error) {
        failures.push(`${fallback.id}:${error.message}`);
      }
    }
    return null;
  };

  if (channel.staticFirst) {
    const staticResolved = await tryStaticFallbacks('static-primary');
    if (staticResolved) return staticResolved;
  }

  const livewatchAttempts = Math.max(1, Number(channel.livewatchRetries || 1));
  for (let attempt = 1; attempt <= livewatchAttempts; attempt += 1) {
    try {
      matches = prioritizeCandidates(channelKey, await findChannelMatches(channel, skipIds), skipIds);
    } catch (error) {
      failures.push(`livewatch-search:${error.message}`);
      matches = [];
    }

    for (const candidate of matches.slice(0, 5)) {
      try {
        const resolved = await resolveCandidate(candidate);
        sourceCache.set(channelKey, {
          id: candidate.id,
          expiresAt: Date.now() + SOURCE_CACHE_TTL_MS
        });
        return {
          ...resolved,
          detection: failures.length ? `livewatch-retry-${attempt}-after-${failures.length}-failure` : 'validated-primary'
        };
      } catch (error) {
        failures.push(`${candidate.id}:${error.message}`);
      }
    }

    if (attempt < livewatchAttempts) await sleep(Number(channel.livewatchRetryDelayMs || 500));
  }

  if (!channel.staticFirst) {
    const staticResolved = await tryStaticFallbacks('static-fallback');
    if (staticResolved) return staticResolved;
  }

  sourceCache.delete(channelKey);
  throw new Error(`no valid source (${failures.join(', ')})`);
}

async function resolveIptvLive(request, requestUrl, channelKey) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const channel = LIVE_CHANNELS.get(channelKey);
  if (!channel) return new Response('Unknown channel', { status: 404, headers: corsHeaders() });

  const skipIds = parseSkipIds(requestUrl);
  let selected;
  try {
    selected = await selectWorkingSource(channelKey, channel, skipIds);
  } catch (error) {
    return new Response(`Dynamic stream URL unavailable (${error.message})`, { status: 502, headers: corsHeaders() });
  }

  const headers = new Headers(corsHeaders());
  headers.set('Content-Type', 'application/vnd.apple.mpegurl');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.set('X-Ares-Channel', channelKey);
  headers.set('X-Ares-Source-Id', selected.candidate.id);
  headers.set('X-Ares-Source-Type', String(selected.candidate.source || 'unknown'));
  headers.set('X-Ares-Source-Quality', String(selected.candidate.quality || 'auto'));
  headers.set('X-Ares-Detection', `${selected.detection}; latency=${selected.latencyMs}ms`);
  headers.set('X-Ares-Resolved-At', new Date().toISOString());
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });

  return new Response(rewritePlaylist(selected.masterText, selected.upstreamUrl, requestUrl.origin), { status: 200, headers });
}

async function proxyIptv(request, requestUrl) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
  }

  const rawUrl = requestUrl.searchParams.get('url') || '';
  if (!rawUrl || rawUrl.length > 8192) {
    return new Response('Missing or invalid upstream URL', { status: 400, headers: corsHeaders() });
  }

  let upstreamUrl;
  try {
    upstreamUrl = new URL(rawUrl);
  } catch (_) {
    return new Response('Invalid upstream URL', { status: 400, headers: corsHeaders() });
  }

  if (!isAllowedProxyUrl(upstreamUrl)) {
    return new Response('Upstream not allowed', { status: 403, headers: corsHeaders() });
  }

  const headersForUpstream = new Headers(upstreamHeaders(upstreamUrl, request.headers.get('Accept') || '*/*'));
  const range = request.headers.get('Range');
  if (range) headersForUpstream.set('Range', range);

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: headersForUpstream,
      redirect: 'follow'
    });
  } catch (error) {
    const headers = new Headers(corsHeaders());
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    headers.set('CDN-Cache-Control', 'no-store');
    headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
    return new Response(`Upstream fetch failed: ${error?.message || 'network error'}`, {
      status: 502,
      headers
    });
  }

  const contentType = hlsContentType(upstreamUrl.pathname, upstream.headers.get('Content-Type'));
  const isPlaylist = request.method === 'GET' && contentType.toLowerCase().includes('mpegurl');

  const headers = new Headers(corsHeaders());
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');

  for (const name of ['Accept-Ranges', 'Content-Length', 'Content-Range']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (isPlaylist) {
    headers.delete('Content-Length');
    return new Response(rewritePlaylist(await upstream.text(), upstreamUrl, requestUrl.origin), {
      status: upstream.status,
      statusText: upstream.statusText,
      headers
    });
  }

  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === PROXY_PATH) return proxyIptv(request, url);

    const liveMatch = url.pathname.match(/^\/api\/iptv\/live\/([a-z0-9-]+)\/master\.m3u8$/i);
    if (liveMatch) return resolveIptvLive(request, url, liveMatch[1].toLowerCase());

    if (url.pathname === '/api/iptv/channels') {
      return new Response(JSON.stringify(Array.from(LIVE_CHANNELS.keys())), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders() });
  }
};
