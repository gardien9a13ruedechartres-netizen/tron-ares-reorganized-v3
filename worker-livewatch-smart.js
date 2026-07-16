const LIVEWATCH_ORIGIN = "https://livewatch.top";
const LOVETIER_ORIGIN = "https://deviantart.lovetier.bz";
const LOVETIER_PLAYER_ORIGIN = "https://lovetier.bz";
const BLUETIER_ORIGIN = "https://cdn.bluetier.top";
const CLOUDING_ORIGIN = "https://clouding.wideiptv.top";
const CLOUDING_PLAYER_ORIGIN = "https://popcdn.day";
const PROXY_PATH = "/api/proxy";
const SOURCE_TEST_TIMEOUT_MS = 7000;
const SOURCE_CACHE_TTL_MS = 30000;

const CHANNELS = {
  cmtv: {
    label: "CMTV",
    defaultOrder: ["cable", "basic"],
    sources: {
      cable: {
        id: "805844173b05e1a81e31d-579768661fe265",
        label: "LiveWatch cable"
      },
      basic: {
        id: "384601660517fa3552a29f-6816b5893e5bcc",
        label: "LiveWatch basic"
      }
    },
    manualSources: {
      clouding: {
        kind: "clouding",
        id: "legacy-clouding-cmtvpt",
        label: "Clouding CMTV",
        button: "Clouding",
        cloudingChannel: "CMTVPT"
      }
    }
  },
  w9: {
    label: "W9",
    defaultOrder: ["satellite", "basic", "cable"],
    sources: {
      satellite: {
        id: "338554998683e8b650775f-03d803b21aa717",
        label: "LiveWatch satellite"
      },
      basic: {
        id: "12804661554f36ca1095a-36724fff9f173c",
        label: "LiveWatch basic"
      },
      cable: {
        id: "280062836403e9b757ac4c-427ac871825faa",
        label: "LiveWatch cable"
      }
    }
  },
  btv: {
    label: "BTV",
    defaultOrder: ["basic", "cable"],
    sources: {
      basic: {
        id: "419434034c29c7a3c7b07-c30c1297e6e5ce",
        label: "LiveWatch basic HD"
      },
      cable: {
        id: "2434383426cedb9a7f8182-853d5b7284c58b",
        label: "LiveWatch cable"
      }
    },
    manualSources: {
      deviantart: {
        kind: "lovetier",
        id: "legacy-lovetier-btv",
        label: "DeviantArt BTV",
        button: "DeviantArt",
        lovetierChannel: "BTV1"
      }
    }
  },
  tf1: {
    label: "TF1",
    defaultOrder: ["basic", "satellite"],
    sources: {
      satellite: {
        id: "2913521200ae11151a1fc4-b5746bd2522e5c",
        label: "LiveWatch satellite"
      },
      basic: {
        id: "1334669376bf508b8ed995-e1dc32893923cf",
        label: "LiveWatch basic FHD"
      }
    },
    manualSources: {
      deviantart: {
        kind: "lovetier",
        id: "legacy-lovetier-tf1fr",
        label: "DeviantArt TF1",
        button: "DeviantArt",
        lovetierChannel: "TF1FR"
      }
    }
  },
  tf1sf: {
    label: "TF1 Series & Film",
    defaultOrder: ["satellite-hd", "satellite"],
    sources: {
      satellite: {
        id: "1760063888f6e9e21d8039-e1c647aa24dff8",
        label: "LiveWatch satellite"
      },
      "satellite-hd": {
        id: "3049436856cd6a1575450a-d6ab2a40a54f7a",
        label: "LiveWatch satellite HD"
      }
    }
  },
  "canal-panda": {
    label: "Canal Panda",
    defaultOrder: ["cable", "basic"],
    sources: {
      cable: {
        id: "26958390437906a5f4ba97-d22b5eb462d646",
        label: "LiveWatch cable"
      },
      basic: {
        id: "4002241315e5ee10f4b753-97c7a8325393c2",
        label: "LiveWatch basic"
      }
    }
  },
  "canal-plus": {
    label: "CANAL+",
    defaultOrder: ["satellite", "cable", "basic-fhd", "basic-hd", "basic-4k"],
    sources: {
      cable: {
        id: "1839597702d549646f5393-2ac8f134e5cc3d",
        label: "LiveWatch cable"
      },
      satellite: {
        id: "6981957d8c5d6ef6ebe-00e248dcf7e873",
        label: "LiveWatch satellite"
      },
      "basic-fhd": {
        id: "298747715234a3a02669b8-699fafb82ad92d",
        label: "LiveWatch basic FHD"
      },
      "basic-hd": {
        id: "1860727909951701e97ea9-0552c051c6ab52",
        label: "LiveWatch basic HD"
      },
      "basic-4k": {
        id: "2421698062be5948a928f5-92450af7cf51c2",
        label: "LiveWatch basic 4K"
      }
    },
    manualSources: {
      deviantart: {
        kind: "lovetier",
        id: "legacy-lovetier-canalplfr",
        label: "DeviantArt CANAL+",
        button: "DeviantArt",
        lovetierChannel: "CANALPLFR"
      }
    }
  }
};


// Imported LiveWatch channels from worker-iptv3.
Object.assign(CHANNELS, {
  "canal-gr-ecran": {
    "label": "CANAL+ GRAND ECRAN",
    "defaultOrder": [
      "cable",
      "satellite-fhd",
      "basic-fhd",
      "basic-hd"
    ],
    "sources": {
      "cable": {
        "id": "25747471736b92892116f8-9e6e1088c67bdc",
        "label": "LiveWatch cable"
      },
      "satellite-fhd": {
        "id": "25481898009fc4dd96f118-ebf0455ad2d869",
        "label": "LiveWatch satellite FHD"
      },
      "basic-fhd": {
        "id": "764514828841cf1a946e8-a890035e372e41",
        "label": "LiveWatch basic FHD"
      },
      "basic-hd": {
        "id": "13730112351c691b47ed3b-da2c3b2aa7a4bb",
        "label": "LiveWatch basic HD"
      }
    }
  },
  "canal-cinema": {
    "label": "CANAL+ CINEMA",
    "defaultOrder": [
      "cable",
      "satellite",
      "satellite-fhd",
      "satellite-hd"
    ],
    "sources": {
      "cable": {
        "id": "3980730104297e5d74da47-ae5ab89e27534a",
        "label": "LiveWatch cable"
      },
      "satellite": {
        "id": "7815381974235226e525c-08b89a15623fb6",
        "label": "LiveWatch satellite"
      },
      "satellite-fhd": {
        "id": "2898387495718e66ec3be-c854d47617c539",
        "label": "LiveWatch satellite FHD"
      },
      "satellite-hd": {
        "id": "9740778764179b9c92456-b9dbab0a86d0a4",
        "label": "LiveWatch satellite HD"
      }
    }
  },
  "canal-series": {
    "label": "CANAL+ SERIES",
    "defaultOrder": [
      "cable",
      "satellite",
      "satellite-fhd",
      "basic-fhd",
      "satellite-hd",
      "basic-4k"
    ],
    "sources": {
      "cable": {
        "id": "907568283b0bf51903416-605791705e0c48",
        "label": "LiveWatch cable"
      },
      "satellite": {
        "id": "412353586256ea59f8b7b5-48ff83e119e784",
        "label": "LiveWatch satellite"
      },
      "satellite-fhd": {
        "id": "2141653939fb56edcf97da-a136854c58391a",
        "label": "LiveWatch satellite FHD"
      },
      "basic-fhd": {
        "id": "2354397782686b0f84677f-21272264449cba",
        "label": "LiveWatch basic FHD"
      },
      "satellite-hd": {
        "id": "296255235587d472eb18c8-a46767322a9b14",
        "label": "LiveWatch satellite HD"
      },
      "basic-4k": {
        "id": "31229880095478070434b1-49a1fae602e682",
        "label": "LiveWatch basic 4K"
      }
    }
  },
  "6ter": {
    "label": "6TER",
    "defaultOrder": [
      "livewatch"
    ],
    "sources": {
      "livewatch": {
        "kind": "livewatch-search",
        "id": "dynamic-livewatch-6ter",
        "label": "LiveWatch auto",
        "button": "LiveWatch auto",
        "search": "6TER",
        "exact": "6TER",
        "country": "France",
        "prefer": [
          "FHD",
          "HD",
          null
        ],
        "sourcePrefer": [],
        "excludeIds": []
      }
    }
  },
  "cstar": {
    "label": "C STAR",
    "defaultOrder": [
      "satellite-fhd",
      "cable"
    ],
    "sources": {
      "satellite-fhd": {
        "id": "3480426017c3f2b3e10a98-4eb0ab5a31ab6c",
        "label": "LiveWatch satellite FHD"
      },
      "cable": {
        "id": "3166346130b6b8b30bb9d2-eda28228a50465",
        "label": "LiveWatch cable"
      }
    }
  },
  "sport-tv-1": {
    "label": "SPORT TV 1",
    "defaultOrder": [
      "basic-hd",
      "basic-hd-backup",
      "basic",
      "cable",
      "basic-backup"
    ],
    "sources": {
      "basic-hd": {
        "id": "3966581533812bd3be6382-2dee5e113ca360",
        "label": "LiveWatch basic HD"
      },
      "basic-hd-backup": {
        "id": "211283081051caac7287c4-b0c19770b7972b",
        "label": "LiveWatch basic HD backup"
      },
      "basic": {
        "id": "10004270647c8377fd8313-31e3d5c4614739",
        "label": "LiveWatch basic"
      },
      "cable": {
        "id": "34289402226976c68b9b9e-bf2069844244ff",
        "label": "LiveWatch cable"
      },
      "basic-backup": {
        "id": "14386289065b08d49bfc3e-61a6d716bcbe83",
        "label": "LiveWatch basic backup"
      }
    },
    "manualSources": {
      "deviantart": {
        "kind": "lovetier",
        "id": "legacy-lovetier-sport-tv-1",
        "label": "DeviantArt SPORT TV 1",
        "button": "DeviantArt",
        "lovetierChannel": "SPT1"
      }
    }
  },
  "sport-tv-5": {
    "label": "SPORT TV 5",
    "defaultOrder": [
      "basic-backup",
      "cable"
    ],
    "sources": {
      "basic-backup": {
        "id": "12763267051751832c99d9-e96250d7d887f8",
        "label": "LiveWatch basic backup"
      },
      "cable": {
        "id": "9711041268146231bc411-77fb597e2397df",
        "label": "LiveWatch cable"
      }
    },
    "manualSources": {
      "deviantart": {
        "kind": "lovetier",
        "id": "legacy-lovetier-sport-tv-5",
        "label": "DeviantArt SPORT TV 5",
        "button": "DeviantArt",
        "lovetierChannel": "SPT5"
      }
    }
  },
  "disney-pixar": {
    "label": "DISNEY+ PIXAR",
    "defaultOrder": [
      "cable"
    ],
    "sources": {
      "cable": {
        "id": "1616464273e04bb68a8a1c-ed3fcb510db31f",
        "label": "LiveWatch cable"
      }
    }
  },
  "tv-globo": {
    "label": "GLOBO BRAZIL",
    "defaultOrder": [
      "cable",
      "basic",
      "basic-2"
    ],
    "sources": {
      "cable": {
        "id": "4138844993f9f6ab3175df-991265815db62b",
        "label": "LiveWatch cable"
      },
      "basic": {
        "id": "3068526841d78e5d3c16ff-dc1695f8251824",
        "label": "LiveWatch basic"
      },
      "basic-2": {
        "id": "20994889228f6a91cba570-41e5862131242f",
        "label": "LiveWatch basic"
      }
    }
  },
  "golf": {
    "label": "GOLF+ CHANNEL",
    "defaultOrder": [
      "satellite",
      "satellite-fhd"
    ],
    "sources": {
      "satellite": {
        "id": "780950104a5cb52c94aa2-88d30a5c48d027",
        "label": "LiveWatch satellite"
      },
      "satellite-fhd": {
        "id": "28324561ced12307fdbb-735096274b0694",
        "label": "LiveWatch satellite FHD"
      }
    }
  },
  "canal-motogp": {
    "label": "CANAL+ MOTO GP",
    "defaultOrder": [
      "satellite"
    ],
    "sources": {
      "satellite": {
        "id": "618190741104165c33a61-e548b12f428898",
        "label": "LiveWatch satellite"
      }
    }
  },
  "ligue-1": {
    "label": "CANAL + LIGUE 1",
    "defaultOrder": [
      "satellite"
    ],
    "sources": {
      "satellite": {
        "id": "3717538119811335a8ce45-921e9afc0afc01",
        "label": "LiveWatch satellite"
      }
    }
  },
  "auto-moto": {
    "label": "AUTOMOTO LA CHAINE",
    "defaultOrder": [
      "satellite-fhd"
    ],
    "sources": {
      "satellite-fhd": {
        "id": "1808973403875ca98b3144-a878c607980fd5",
        "label": "LiveWatch satellite FHD"
      }
    }
  },
  "l-equipe-fr": {
    "label": "L EQUIPE",
    "defaultOrder": [
      "satellite",
      "basic",
      "cable"
    ],
    "sources": {
      "satellite": {
        "id": "38373319428576fb860cef-802f251211ffb1",
        "label": "LiveWatch satellite"
      },
      "basic": {
        "id": "2241995657d1acf374577f-439b1c3988b027",
        "label": "LiveWatch basic"
      },
      "cable": {
        "id": "1064699189d6dd5dc4d422-856d62582d1513",
        "label": "LiveWatch cable"
      }
    }
  },
  "ocs-max": {
    "label": "OCS MAX",
    "defaultOrder": [
      "cable",
      "satellite",
      "satellite-fhd",
      "satellite-hd"
    ],
    "sources": {
      "cable": {
        "id": "636734800c64cceb42cf-7325d09036ee4e",
        "label": "LiveWatch cable"
      },
      "satellite": {
        "id": "42064702927b26fcd04aa-894a8129a06e33",
        "label": "LiveWatch satellite"
      },
      "satellite-fhd": {
        "id": "2561627199a0669a101b1e-f9e6cde850e4ab",
        "label": "LiveWatch satellite FHD"
      },
      "satellite-hd": {
        "id": "151053255430b682f860-71fa30e2ad1689",
        "label": "LiveWatch satellite HD"
      }
    }
  },
  "warner-tv": {
    "label": "WARNER TV",
    "defaultOrder": [
      "cable",
      "satellite",
      "cable-2"
    ],
    "sources": {
      "cable": {
        "id": "30593609059ce1103aec2e-59f2068cdb0b85",
        "label": "LiveWatch cable"
      },
      "satellite": {
        "id": "2978100125aecff8327cf5-ec0eb76b33ec19",
        "label": "LiveWatch satellite"
      },
      "cable-2": {
        "id": "48836462992d6cf6baccf-2dfa35b36b8332",
        "label": "LiveWatch cable"
      }
    }
  },
  "cine-frisson": {
    "label": "CINE+ FRISSON",
    "defaultOrder": [
      "cable"
    ],
    "sources": {
      "cable": {
        "id": "3654122461b46665c82b8f-2f4675d52df5dc",
        "label": "LiveWatch cable"
      }
    }
  },
  "cine-emotion": {
    "label": "CINE+ EMOTION",
    "defaultOrder": [
      "cable",
      "satellite",
      "satellite-fhd",
      "basic-fhd"
    ],
    "sources": {
      "cable": {
        "id": "7546769060ce35541f305-b64237317fb59f",
        "label": "LiveWatch cable"
      },
      "satellite": {
        "id": "4012587463c5d0adb0620e-d6461b78095980",
        "label": "LiveWatch satellite"
      },
      "satellite-fhd": {
        "id": "2737270354dc417dc353b0-3bb897e9f0e140",
        "label": "LiveWatch satellite FHD"
      },
      "basic-fhd": {
        "id": "135614661597d2792a4429-800be2a83171eb",
        "label": "LiveWatch basic FHD"
      }
    }
  },
  "cine-famiz": {
    "label": "CINE FAMIZ",
    "defaultOrder": [
      "basic-fhd",
      "satellite-fhd",
      "satellite-hd",
      "cable",
      "satellite"
    ],
    "sources": {
      "basic-fhd": {
        "id": "3406691536b1c2e278588c-bc9842f244f707",
        "label": "LiveWatch basic FHD"
      },
      "satellite-fhd": {
        "id": "2704150133fbb48751b7b5-70f68d6a9e6286",
        "label": "LiveWatch satellite FHD"
      },
      "satellite-hd": {
        "id": "21820840461c5c31e1d60f-eb26ab270e1d41",
        "label": "LiveWatch satellite HD"
      },
      "cable": {
        "id": "20822805044642b90cf20a-9a5a1a8ea4784b",
        "label": "LiveWatch cable"
      },
      "satellite": {
        "id": "2755354291c0d1748a003f-27af6ccc291db2",
        "label": "LiveWatch satellite"
      }
    }
  },
  "cine-classic": {
    "label": "CINE+ CLASSIC",
    "defaultOrder": [
      "cable",
      "satellite",
      "satellite-fhd",
      "satellite-hd"
    ],
    "sources": {
      "cable": {
        "id": "826335846cd94062fe98-4fb202719f29f1",
        "label": "LiveWatch cable"
      },
      "satellite": {
        "id": "3342642717ab7f2fad50a4-3c594b794f9dee",
        "label": "LiveWatch satellite"
      },
      "satellite-fhd": {
        "id": "581219766ec0c08526620-4c53cd2db97ebc",
        "label": "LiveWatch satellite FHD"
      },
      "satellite-hd": {
        "id": "3677483481c601971abf79-b7fe08230b1502",
        "label": "LiveWatch satellite HD"
      }
    }
  },
  "cine-club": {
    "label": "CINE+ CLUB",
    "defaultOrder": [
      "cable",
      "satellite",
      "satellite-hd",
      "basic-fhd"
    ],
    "sources": {
      "cable": {
        "id": "1800537483f21c95207e51-a7e1f948aac95f",
        "label": "LiveWatch cable"
      },
      "satellite": {
        "id": "176726491979039c050819-b15b40089b122f",
        "label": "LiveWatch satellite"
      },
      "satellite-hd": {
        "id": "5870248549e97edf632cd-1ff1e3a667c107",
        "label": "LiveWatch satellite HD"
      },
      "basic-fhd": {
        "id": "26514025573f474a0abd81-740408c1c368cf",
        "label": "LiveWatch basic FHD"
      }
    }
  },
  "serie-club": {
    "label": "SERIE CLUB",
    "defaultOrder": [
      "cable"
    ],
    "sources": {
      "cable": {
        "id": "1534887525bcb2cc0c943a-0f014dfb9a8451",
        "label": "LiveWatch cable"
      }
    }
  },
  "tcm-cinema": {
    "label": "TCM CINEMA",
    "defaultOrder": [
      "satellite",
      "basic"
    ],
    "sources": {
      "satellite": {
        "id": "2451805128d0f9045d041b-ed47dcec34444c",
        "label": "LiveWatch satellite"
      },
      "basic": {
        "id": "3637294135d561d9540c1c-933813a71d3ece",
        "label": "LiveWatch basic"
      }
    }
  },
  "disney-cinema": {
    "label": "DISNEY CINEMA",
    "defaultOrder": [
      "basic",
      "satellite",
      "basic-backup"
    ],
    "sources": {
      "basic": {
        "id": "13753937069c923e070773-c072ddbe1fd2dc",
        "label": "LiveWatch basic"
      },
      "satellite": {
        "id": "3691576487927392cb891e-14f6b6ead7f4b4",
        "label": "LiveWatch satellite"
      },
      "basic-backup": {
        "id": "1624576575a94e3212da5-5284eaf4bb0ca3",
        "label": "LiveWatch basic backup"
      }
    }
  },
  "disney-junior": {
    "label": "DISNEY JUNIOR",
    "defaultOrder": [
      "satellite",
      "satellite-fhd",
      "basic",
      "basic-backup"
    ],
    "sources": {
      "satellite": {
        "id": "3351330853ba2b580d385f-08df3f69cbcec0",
        "label": "LiveWatch satellite"
      },
      "satellite-fhd": {
        "id": "357894050d7f96e94e22f-7dea5cea101754",
        "label": "LiveWatch satellite FHD"
      },
      "basic": {
        "id": "1244883752934afb7348d0-710962f0dc7de6",
        "label": "LiveWatch basic"
      },
      "basic-backup": {
        "id": "4039125784a8c6af55cefd-1089d3f4d65646",
        "label": "LiveWatch basic backup"
      }
    }
  },
  "cartoon-network": {
    "label": "CARTOON NETWORK",
    "defaultOrder": [
      "cable",
      "satellite-fhd",
      "basic",
      "basic-4k"
    ],
    "sources": {
      "cable": {
        "id": "278630331931d4f590a721-11a3e66f138ae4",
        "label": "LiveWatch cable"
      },
      "satellite-fhd": {
        "id": "2127297858581f62f0bf4c-eef3410f1d1bfb",
        "label": "LiveWatch satellite FHD"
      },
      "basic": {
        "id": "3047805633546dcf9fb24b-e949024146d5d8",
        "label": "LiveWatch basic"
      },
      "basic-4k": {
        "id": "2078762115ee0894e1e157-adbd239d277f15",
        "label": "LiveWatch basic 4K"
      }
    }
  },
  "canal-j": {
    "label": "CANAL J",
    "defaultOrder": [
      "cable",
      "satellite-fhd",
      "basic",
      "basic-backup"
    ],
    "sources": {
      "cable": {
        "id": "85706364091e683ba1a33-5c832e172adad3",
        "label": "LiveWatch cable"
      },
      "satellite-fhd": {
        "id": "24446412ebabf61b09ad-043d27d40d15b4",
        "label": "LiveWatch satellite FHD"
      },
      "basic": {
        "id": "3860888136d301b247640b-021aab3c4b6dfb",
        "label": "LiveWatch basic"
      },
      "basic-backup": {
        "id": "6099304471232528ee2e1-4f07037b01a340",
        "label": "LiveWatch basic backup"
      }
    }
  },
  "teletoon": {
    "label": "TELETOON+",
    "defaultOrder": [
      "cable",
      "satellite",
      "cable-2"
    ],
    "sources": {
      "cable": {
        "id": "2382507077306dedae7ff3-e03c9b3620ee1a",
        "label": "LiveWatch cable"
      },
      "satellite": {
        "id": "231278062503478eaef59f-1363b3bc9b6a6e",
        "label": "LiveWatch satellite"
      },
      "cable-2": {
        "id": "1143042553bb95572793be-4a7357659fbfc8",
        "label": "LiveWatch cable"
      }
    }
  },
  "mangas": {
    "label": "MANGAS",
    "defaultOrder": [
      "satellite",
      "basic",
      "basic-hd"
    ],
    "sources": {
      "satellite": {
        "id": "139408412ba8e0ae7a800-af3111e493d466",
        "label": "LiveWatch satellite"
      },
      "basic": {
        "id": "3781018265a0de3a4a5f34-cb323ba5b11df7",
        "label": "LiveWatch basic"
      },
      "basic-hd": {
        "id": "401237472a1e90e56167a-e5d148a48b2e03",
        "label": "LiveWatch basic HD"
      }
    }
  },
  "j-one": {
    "label": "J-ONE",
    "defaultOrder": [
      "basic"
    ],
    "sources": {
      "basic": {
        "id": "874035777bcae83ee8339-448ec8df936ca1",
        "label": "LiveWatch basic"
      }
    }
  },
  "tiji": {
    "label": "TIJI",
    "defaultOrder": [
      "satellite-fhd",
      "satellite-hd",
      "basic"
    ],
    "sources": {
      "satellite-fhd": {
        "id": "381228029420ab3e3544f6-b7ace7d491d7aa",
        "label": "LiveWatch satellite FHD"
      },
      "satellite-hd": {
        "id": "61014295140065dfc1ba9-42df2ea83b0598",
        "label": "LiveWatch satellite HD"
      },
      "basic": {
        "id": "12869143765e4bc62e1bc-a831bfc016195f",
        "label": "LiveWatch basic"
      }
    }
  },
  "nickelodeon": {
    "label": "NICKELODEON",
    "defaultOrder": [
      "cable",
      "satellite",
      "cable-2",
      "cable-3"
    ],
    "sources": {
      "cable": {
        "id": "280381887053bd39b0c65f-f0abfafee5bc9c",
        "label": "LiveWatch cable"
      },
      "satellite": {
        "id": "2881806872c3195b245695-8f25ba9085fc8e",
        "label": "LiveWatch satellite"
      },
      "cable-2": {
        "id": "2600378206c4151e6fe1dd-7e83c87ae047f4",
        "label": "LiveWatch cable"
      },
      "cable-3": {
        "id": "2786840044bbf88bfbe8f7-6c830fd8cea545",
        "label": "LiveWatch cable"
      }
    }
  },
  "boing": {
    "label": "BOING",
    "defaultOrder": [
      "basic"
    ],
    "sources": {
      "basic": {
        "id": "69130693e2582f2056fe-1367813e7d7947",
        "label": "LiveWatch basic"
      }
    }
  },
  "game-one": {
    "label": "GAME ONE",
    "defaultOrder": [
      "cable",
      "satellite"
    ],
    "sources": {
      "cable": {
        "id": "22141630554906bb2fc4a4-615863c6daad76",
        "label": "LiveWatch cable"
      },
      "satellite": {
        "id": "1479966396202ff806f8d8-cbf2e8251593f3",
        "label": "LiveWatch satellite"
      }
    }
  },
  "toonami": {
    "label": "TOONAMI",
    "defaultOrder": [
      "cable"
    ],
    "sources": {
      "cable": {
        "id": "4132905048a27f69176a77-f271550b92fa28",
        "label": "LiveWatch cable"
      }
    }
  },
  "toute-l-histoire": {
    "label": "TOUTE L HISTOIRE",
    "defaultOrder": [
      "satellite",
      "satellite-hd"
    ],
    "sources": {
      "satellite": {
        "id": "22335450950012aecee2ea-0f5f79eca55d8f",
        "label": "LiveWatch satellite"
      },
      "satellite-hd": {
        "id": "31946318574d1657fbd437-c09eeedf8b9fdb",
        "label": "LiveWatch satellite HD"
      }
    }
  },
  "nat-geo": {
    "label": "NAT GEO",
    "defaultOrder": [
      "cable",
      "satellite-fhd"
    ],
    "sources": {
      "cable": {
        "id": "13411697827c093b9217a6-d306fbe39a12c6",
        "label": "LiveWatch cable"
      },
      "satellite-fhd": {
        "id": "2662111844aff3a550d3f7-7ba789afe7e146",
        "label": "LiveWatch satellite FHD"
      }
    }
  },
  "nat-geo-wild": {
    "label": "NAT GEO WILD",
    "defaultOrder": [
      "cable",
      "satellite",
      "satellite-fhd",
      "satellite-hd"
    ],
    "sources": {
      "cable": {
        "id": "4163250572cb7f669550a4-3d0d5a84418865",
        "label": "LiveWatch cable"
      },
      "satellite": {
        "id": "12578909822641fbc02dc3-c31972024bfa81",
        "label": "LiveWatch satellite"
      },
      "satellite-fhd": {
        "id": "295899358126aff7725d18-fdee8f20c90503",
        "label": "LiveWatch satellite FHD"
      },
      "satellite-hd": {
        "id": "4087509269bc6b8e5313a4-bcff710cb1d8ee",
        "label": "LiveWatch satellite HD"
      }
    }
  },
  "discovery-science": {
    "label": "DISCOVERY SCIENCE",
    "defaultOrder": [
      "satellite",
      "basic"
    ],
    "sources": {
      "satellite": {
        "id": "27011456832d97fd3f96b1-a853c618061161",
        "label": "LiveWatch satellite"
      },
      "basic": {
        "id": "13916241181642741e7fb7-fdaacb46707245",
        "label": "LiveWatch basic"
      }
    }
  },
  "ushuaia-tv": {
    "label": "USHUAIA",
    "defaultOrder": [
      "satellite",
      "satellite-fhd",
      "satellite-hd",
      "basic-hd"
    ],
    "sources": {
      "satellite": {
        "id": "4274246496cae3eb6b9282-fd0a6c4baf6755",
        "label": "LiveWatch satellite"
      },
      "satellite-fhd": {
        "id": "7377560460dce594183e5-ad52d57e270076",
        "label": "LiveWatch satellite FHD"
      },
      "satellite-hd": {
        "id": "814473941476083b06ccb-aa495a509760c4",
        "label": "LiveWatch satellite HD"
      },
      "basic-hd": {
        "id": "30343651343100cf58d048-49ae141343babb",
        "label": "LiveWatch basic HD"
      }
    }
  },
  "science-vie": {
    "label": "SCIENCE & VIE",
    "defaultOrder": [
      "satellite",
      "cable"
    ],
    "sources": {
      "satellite": {
        "id": "38619424749a7f941cb30-54abd9ba33e71b",
        "label": "LiveWatch satellite"
      },
      "cable": {
        "id": "152357533f67555e62908-aa5ee95724bef2",
        "label": "LiveWatch cable"
      }
    }
  },
  "planete-crime": {
    "label": "PLANETE+ CRIME",
    "defaultOrder": [
      "satellite",
      "satellite-hd"
    ],
    "sources": {
      "satellite": {
        "id": "18698414995fd862423d6-6f3ef08a42e1bc",
        "label": "LiveWatch satellite"
      },
      "satellite-hd": {
        "id": "3552349294e8f1f6a1d376-8e3ce7fd7b5016",
        "label": "LiveWatch satellite HD"
      }
    }
  },
  "animaux": {
    "label": "ANIMAUX",
    "defaultOrder": [
      "cable",
      "satellite",
      "basic"
    ],
    "sources": {
      "cable": {
        "kind": "livewatch-search",
        "id": "dynamic-livewatch-animaux-cable",
        "label": "LiveWatch cable",
        "button": "LiveWatch cable",
        "country": "France",
        "search": "Animaux",
        "exact": "ANIMAUX",
        "sourcePrefer": ["cable"]
      },
      "satellite": {
        "kind": "livewatch-search",
        "id": "dynamic-livewatch-animaux-satellite",
        "label": "LiveWatch satellite",
        "button": "LiveWatch satellite",
        "country": "France",
        "search": "Animaux",
        "exact": "ANIMAUX",
        "sourcePrefer": ["satellite"]
      },
      "basic": {
        "kind": "livewatch-search",
        "id": "dynamic-livewatch-animaux-basic",
        "label": "LiveWatch basic",
        "button": "LiveWatch basic",
        "country": "France",
        "search": "Animaux",
        "exact": "ANIMAUX",
        "sourcePrefer": ["basic"]
      }
    }
  },
  "rmc-decouverte-2": {
    "label": "RMC DECOUVERTE",
    "defaultOrder": [
      "satellite"
    ],
    "sources": {
      "satellite": {
        "id": "26066150769be8b83ee804-af017e71349872",
        "label": "LiveWatch satellite"
      }
    }
  },
  "investigation-discovery": {
    "label": "INVESTIGATION DISCOVERY",
    "defaultOrder": [
      "cable"
    ],
    "sources": {
      "cable": {
        "id": "286307272239f45a9230cb-3b4db1b78f26f3",
        "label": "LiveWatch cable"
      }
    }
  },
  "chasse-peche": {
    "label": "CHASSE & PECHE",
    "defaultOrder": [
      "cable",
      "satellite"
    ],
    "sources": {
      "cable": {
        "id": "30277092126bc746a51a20-d17faee3c160af",
        "label": "LiveWatch cable"
      },
      "satellite": {
        "id": "2674834370a1cac4b77989-e6c20205a967e8",
        "label": "LiveWatch satellite"
      }
    }
  },
  "crime-district": {
    "label": "CRIME DISTRICT",
    "defaultOrder": [
      "cable",
      "satellite"
    ],
    "sources": {
      "cable": {
        "id": "233249952949b217798c9e-4beb79d74324a1",
        "label": "LiveWatch cable"
      },
      "satellite": {
        "id": "26863556070010417e6d9d-8989a74e7c7b85",
        "label": "LiveWatch satellite"
      }
    }
  },
  "mcm": {
    "label": "MCM",
    "defaultOrder": [
      "satellite",
      "satellite-hd",
      "cable",
      "cable-2"
    ],
    "sources": {
      "satellite": {
        "id": "855739216dd3b63b126bc-2ebedcfec45012",
        "label": "LiveWatch satellite"
      },
      "satellite-hd": {
        "id": "33400096800b79d7bb9d9-5ca9814ebe0f2f",
        "label": "LiveWatch satellite HD"
      },
      "cable": {
        "id": "8696880859ab59a847a37-1acc146d4bb3d4",
        "label": "LiveWatch cable"
      },
      "cable-2": {
        "id": "33487111745e397d403417-d2c67332238dbd",
        "label": "LiveWatch cable"
      }
    }
  },
  "m6-music": {
    "label": "M6 MUSIC",
    "defaultOrder": [
      "cable",
      "satellite",
      "basic-hd",
      "satellite-backup"
    ],
    "sources": {
      "cable": {
        "id": "4154285296f902b73b0d28-87a81f8557de0d",
        "label": "LiveWatch cable"
      },
      "satellite": {
        "id": "7435919714613b22a77d1-a6d54f4daab9d6",
        "label": "LiveWatch satellite"
      },
      "basic-hd": {
        "id": "285936085861281a838c2f-9ae29e33139ec9",
        "label": "LiveWatch basic HD"
      },
      "satellite-backup": {
        "id": "38871521898e03f2cfd86d-baee3d9fb1aa96",
        "label": "LiveWatch satellite backup"
      }
    }
  },
  "mtv": {
    "label": "MTV",
    "defaultOrder": [
      "satellite",
      "satellite-fhd",
      "cable",
      "satellite-2"
    ],
    "sources": {
      "satellite": {
        "id": "987897824424746e378ce-28029f74c62f46",
        "label": "LiveWatch satellite"
      },
      "satellite-fhd": {
        "id": "131724335525762423a972-63da2e4425c6be",
        "label": "LiveWatch satellite FHD"
      },
      "cable": {
        "id": "808220806e13753a10c7c-3a533f91f48d29",
        "label": "LiveWatch cable"
      },
      "satellite-2": {
        "id": "84149442655bf9ba0d47b-28fa7a18187594",
        "label": "LiveWatch satellite"
      }
    }
  },
  "mtv-hits": {
    "label": "MTV HITS",
    "defaultOrder": [
      "satellite",
      "basic"
    ],
    "sources": {
      "satellite": {
        "id": "2301201739cd8e74158e09-96f25fb704ee3b",
        "label": "LiveWatch satellite"
      },
      "basic": {
        "id": "199610210545959c828fd6-c5f21ab7eb0770",
        "label": "LiveWatch basic"
      }
    }
  },
  "nrj-hits": {
    "label": "NRJ HITS",
    "defaultOrder": [
      "satellite",
      "basic-hd"
    ],
    "sources": {
      "satellite": {
        "id": "730920094046c7f17c984-7c2374b1edf467",
        "label": "LiveWatch satellite"
      },
      "basic-hd": {
        "id": "3639203183127ef9073e5d-80087061989ddf",
        "label": "LiveWatch basic HD"
      }
    }
  },
  "bfm-business": {
    "label": "BFM BUSINESS",
    "defaultOrder": [
      "cable"
    ],
    "sources": {
      "cable": {
        "id": "1945266328e8e437e6162d-e36c345412b4b4",
        "label": "LiveWatch cable"
      }
    }
  },
  "m6": {
    "label": "M6",
    "defaultOrder": [
      "livewatch"
    ],
    "sources": {
      "livewatch": {
        "kind": "livewatch-search",
        "id": "dynamic-livewatch-m6",
        "label": "LiveWatch auto",
        "button": "LiveWatch auto",
        "search": "M6",
        "exact": "M6",
        "country": "France",
        "prefer": [
          "FHD",
          "HD",
          null
        ],
        "sourcePrefer": [],
        "excludeIds": []
      }
    },
    "manualSources": {
      "deviantart": {
        "kind": "lovetier",
        "id": "legacy-lovetier-m6fr",
        "label": "DeviantArt M6",
        "button": "DeviantArt",
        "lovetierChannel": "M6FR"
      }
    }
  }
});

const sourceCache = new Map();

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Accept, Content-Type",
    "Access-Control-Expose-Headers": [
      "Content-Length",
      "Content-Range",
      "Accept-Ranges",
      "X-Livewatch-Smart-Channel",
      "X-Livewatch-Smart-Mode",
      "X-Livewatch-Smart-Source",
      "X-Livewatch-Smart-Source-Id",
      "X-Livewatch-Smart-Detection",
      "X-Livewatch-Smart-Latency"
    ].join(", ")
  };
}

function livewatchHeaders(accept = "*/*") {
  return {
    Accept: accept,
    Referer: `${LIVEWATCH_ORIGIN}/`,
    "User-Agent": "Mozilla/5.0"
  };
}

function upstreamHeaders(url, accept = "*/*") {
  const headers = {
    Accept: accept,
    "User-Agent": "Mozilla/5.0"
  };
  if (url.origin === LIVEWATCH_ORIGIN) headers.Referer = `${LIVEWATCH_ORIGIN}/`;
  if (url.origin === LOVETIER_ORIGIN || url.origin === BLUETIER_ORIGIN) headers.Referer = `${LOVETIER_PLAYER_ORIGIN}/`;
  if (url.origin === CLOUDING_ORIGIN) headers.Referer = `${CLOUDING_PLAYER_ORIGIN}/`;
  return headers;
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = SOURCE_TEST_TIMEOUT_MS) {
  const timeout = timeoutSignal(timeoutMs);
  try {
    return await fetch(url, { ...options, signal: timeout.signal });
  } finally {
    timeout.cancel();
  }
}

function normalizeChannelKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getChannel(channelKey) {
  const normalized = normalizeChannelKey(channelKey || "cmtv");
  return CHANNELS[normalized] ? { key: normalized, config: CHANNELS[normalized] } : null;
}

function allSources(channel) {
  return {
    ...(channel.sources || {}),
    ...(channel.manualSources || {})
  };
}

function configuredManualPaths(kind, property) {
  const paths = new Set();
  for (const channel of Object.values(CHANNELS)) {
    for (const source of Object.values(channel.manualSources || {})) {
      if (source.kind === kind && source[property]) {
        paths.add(`/${String(source[property]).toLowerCase()}/`);
      }
    }
  }
  return paths;
}

function isAllowedLivewatchUrl(url) {
  return url.origin === LIVEWATCH_ORIGIN &&
    url.pathname === "/api/hls" &&
    url.searchParams.has("t") &&
    !url.username &&
    !url.password;
}

function isAllowedLovetierUrl(url) {
  const paths = configuredManualPaths("lovetier", "lovetierChannel");
  return (url.origin === LOVETIER_ORIGIN || url.origin === BLUETIER_ORIGIN) &&
    Array.from(paths).some((path) => url.pathname.toLowerCase().startsWith(path)) &&
    !url.username &&
    !url.password;
}

function isAllowedCloudingUrl(url) {
  const paths = configuredManualPaths("clouding", "cloudingChannel");
  return url.origin === CLOUDING_ORIGIN &&
    Array.from(paths).some((path) => url.pathname.toLowerCase().startsWith(path)) &&
    !url.username &&
    !url.password;
}

function isAllowedProxyUrl(url) {
  return isAllowedLivewatchUrl(url) || isAllowedLovetierUrl(url) || isAllowedCloudingUrl(url);
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
  return text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (!trimmed.startsWith("#")) return makeProxyUrl(trimmed, upstreamUrl, publicOrigin);
    return line
      .replace(/URI="([^"]+)"/g, (match, value) => `URI="${makeProxyUrl(value, upstreamUrl, publicOrigin)}"`)
      .replace(/URI='([^']+)'/g, (match, value) => `URI='${makeProxyUrl(value, upstreamUrl, publicOrigin)}'`);
  }).join("\n");
}

function hlsContentType(pathname, fallback) {
  const type = String(fallback || "").split(";")[0].trim().toLowerCase();
  if (type.includes("mpegurl") || type.includes("x-mpegurl")) return "application/vnd.apple.mpegurl";
  if (type.includes("mp2t")) return "video/mp2t";
  if (type.includes("iso.segment")) return "video/iso.segment";
  if (type.includes("mp4")) return "video/mp4";
  if (type.includes("aac")) return "audio/aac";
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (lower.endsWith(".ts")) return "video/mp2t";
  if (lower.endsWith(".m4s")) return "video/iso.segment";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".aac")) return "audio/aac";
  return fallback || "application/octet-stream";
}

function smartDefaultOrder(channel) {
  const sources = allSources(channel);
  const seen = new Set();
  const order = [];
  for (const value of [
    ...(channel.defaultOrder || []),
    ...Object.keys(channel.manualSources || {})
  ]) {
    const key = String(value || "").trim().toLowerCase();
    if (!key || seen.has(key) || !sources[key]) continue;
    seen.add(key);
    order.push(key);
  }
  return order;
}

function parseOrder(requestUrl, channel) {
  const skip = new Set(String(requestUrl.searchParams.get("skip") || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean));
  const raw = String(requestUrl.searchParams.get("order") || "").trim();
  const sources = allSources(channel);
  const defaults = smartDefaultOrder(channel);
  const order = (raw ? raw.split(",") : defaults)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => sources[value])
    .filter((value) => !skip.has(value));
  return order.length ? order : defaults.filter((value) => !skip.has(value));
}

function cacheKey(channelKey, mode, requestUrl, channel) {
  if (mode !== "auto") return "";
  return `${channelKey}:auto:${parseOrder(requestUrl, channel).join(",")}`;
}

function readCache(channelKey, mode, requestUrl, channel) {
  const key = cacheKey(channelKey, mode, requestUrl, channel);
  if (!key) return null;
  const cached = sourceCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    sourceCache.delete(key);
    return null;
  }
  return cached.value;
}

function writeCache(channelKey, mode, requestUrl, channel, value) {
  const key = cacheKey(channelKey, mode, requestUrl, channel);
  if (!key) return;
  sourceCache.set(key, { value, expiresAt: Date.now() + SOURCE_CACHE_TTL_MS });
}

function sourcePreferenceScore(source, config) {
  if (Array.isArray(config?.sourcePrefer) && config.sourcePrefer.length) {
    const index = config.sourcePrefer.indexOf(String(source || '').toLowerCase());
    return index >= 0 ? 30 - index * 10 : 0;
  }
  const normalized = String(source || '').toLowerCase();
  if (normalized === 'basic') return 20;
  if (normalized === 'satellite') return 10;
  if (normalized === 'cable') return 5;
  return 0;
}

function normalizeQuality(value) {
  return value == null ? null : String(value).toUpperCase();
}

function qualityRank(config, item) {
  const prefer = Array.isArray(config?.prefer) ? config.prefer.map(normalizeQuality) : [];
  const index = prefer.indexOf(normalizeQuality(item?.quality));
  const qualityScore = index >= 0 ? 100 - index : 0;
  return qualityScore + sourcePreferenceScore(item?.source, config);
}

async function resolveLivewatchSearchSource(channelKey, sourceName, source) {
  const apiUrl = new URL('/api/channels', LIVEWATCH_ORIGIN);
  apiUrl.searchParams.set('country', source.country || '');
  apiUrl.searchParams.set('limit', '20');
  apiUrl.searchParams.set('search', source.search || source.exact || '');

  const response = await fetchWithTimeout(apiUrl, {
    headers: livewatchHeaders('application/json,text/plain,*/*'),
    redirect: 'follow'
  });
  if (!response.ok) throw new Error(`channels ${response.status}`);

  const data = await response.json();
  const exact = String(source.exact || source.search || '').toLowerCase();
  const excluded = new Set((source.excludeIds || []).map((id) => String(id)));
  const matches = (data.channels || [])
    .filter((item) => String(item.name || '').toLowerCase() === exact)
    .filter((item) => !excluded.has(String(item.id || '')))
    .sort((a, b) => qualityRank(source, b) - qualityRank(source, a));

  if (!matches.length) throw new Error('livewatch channel not found');
  const selected = matches[0];
  const quality = selected.quality ? ` ${selected.quality}` : '';
  const label = `LiveWatch ${selected.source || 'auto'}${quality}`;
  return resolveLivewatchSource(channelKey, sourceName, {
    id: String(selected.id || ''),
    label
  });
}

async function resolveLivewatchSource(channelKey, sourceName, source) {
  if (!source) throw new Error(`unknown source ${sourceName}`);
  const streamUrl = new URL(`/api/stream/${encodeURIComponent(source.id)}`, LIVEWATCH_ORIGIN);
  const streamResponse = await fetchWithTimeout(streamUrl, {
    headers: livewatchHeaders("application/json,text/plain,*/*"),
    redirect: "follow"
  });
  if (!streamResponse.ok) throw new Error(`stream ${streamResponse.status}`);
  const streamData = await streamResponse.json();
  const upstreamUrl = new URL(streamData.proxy_url, LIVEWATCH_ORIGIN);
  if (!isAllowedLivewatchUrl(upstreamUrl)) throw new Error("livewatch URL refused");
  const startedAt = Date.now();
  const master = await fetchWithTimeout(upstreamUrl, {
    headers: livewatchHeaders("application/vnd.apple.mpegurl,application/x-mpegURL,*/*"),
    redirect: "follow"
  });
  const latencyMs = Date.now() - startedAt;
  const masterText = await master.text();
  if (!master.ok || !masterText.trimStart().startsWith("#EXTM3U")) {
    throw new Error(`master ${master.status}`);
  }
  return {
    channelKey,
    mode: sourceName,
    source: sourceName,
    sourceId: source.id,
    label: source.label,
    upstreamUrl,
    masterText,
    latencyMs
  };
}

async function resolveCloudingSource(channelKey, sourceName, source) {
  const channel = String(source.cloudingChannel || "");
  if (!channel || !/^[a-z0-9_-]+$/i.test(channel)) throw new Error("clouding channel refused");

  const sourceUrl = new URL("/player.php", CLOUDING_PLAYER_ORIGIN);
  sourceUrl.searchParams.set("stream", channel);
  const sourceResponse = await fetchWithTimeout(sourceUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0"
    },
    redirect: "follow"
  });
  if (!sourceResponse.ok) throw new Error(`clouding source ${sourceResponse.status}`);

  const sourceHtml = await sourceResponse.text();
  const pattern = new RegExp(
    `https://clouding\\.wideiptv\\.top/${escapeRegex(channel)}/embed\\.html\\?token=([^"'\\s<>&]+)`,
    "i"
  );
  const match = sourceHtml.match(pattern);
  if (!match || !match[1]) throw new Error("clouding token unavailable");

  const upstreamUrl = new URL(`${CLOUDING_ORIGIN}/${channel}/index.fmp4.m3u8`);
  upstreamUrl.searchParams.set("token", match[1]);
  if (!isAllowedCloudingUrl(upstreamUrl)) throw new Error("clouding stream URL refused");

  const startedAt = Date.now();
  const master = await fetchWithTimeout(upstreamUrl, {
    headers: upstreamHeaders(upstreamUrl, "application/vnd.apple.mpegurl,application/x-mpegURL,*/*"),
    redirect: "follow"
  });
  const latencyMs = Date.now() - startedAt;
  const masterText = await master.text();
  if (!master.ok || !masterText.trimStart().startsWith("#EXTM3U")) {
    throw new Error(`clouding master ${master.status}`);
  }

  return {
    channelKey,
    mode: sourceName,
    source: sourceName,
    sourceId: source.id,
    label: source.label,
    upstreamUrl,
    masterText,
    latencyMs
  };
}

async function resolveLovetierSource(channelKey, sourceName, source) {
  const channel = String(source.lovetierChannel || "");
  if (!channel || !/^[a-z0-9_-]+$/i.test(channel)) throw new Error("lovetier channel refused");

  const sourceUrl = new URL(`/player/${channel}`, LOVETIER_PLAYER_ORIGIN);
  const sourceResponse = await fetchWithTimeout(sourceUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0"
    },
    redirect: "follow"
  });
  if (!sourceResponse.ok) throw new Error(`lovetier source ${sourceResponse.status}`);

  const sourceHtml = await sourceResponse.text();
  const match = sourceHtml.match(/streamUrl:\s*"([^"]+)"/i);
  if (!match || !match[1]) throw new Error("lovetier stream URL unavailable");

  const upstreamUrl = new URL(
    match[1]
      .replace(/\\\//g, "/")
      .replace(/\\u0026/gi, "&")
  );
  if (
    !isAllowedLovetierUrl(upstreamUrl) ||
    !upstreamUrl.pathname.toLowerCase().endsWith(".m3u8") ||
    !upstreamUrl.searchParams.has("token")
  ) {
    throw new Error("lovetier stream URL refused");
  }

  const startedAt = Date.now();
  const master = await fetchWithTimeout(upstreamUrl, {
    headers: upstreamHeaders(upstreamUrl, "application/vnd.apple.mpegurl,application/x-mpegURL,*/*"),
    redirect: "follow"
  });
  const latencyMs = Date.now() - startedAt;
  const masterText = await master.text();
  if (!master.ok || !masterText.trimStart().startsWith("#EXTM3U")) {
    throw new Error(`lovetier master ${master.status}`);
  }

  return {
    channelKey,
    mode: sourceName,
    source: sourceName,
    sourceId: source.id,
    label: source.label,
    upstreamUrl,
    masterText,
    latencyMs
  };
}

async function resolveSource(channelKey, channel, sourceName) {
  const source = allSources(channel)[sourceName];
  if (!source) throw new Error(`unknown source ${sourceName}`);
  if (source.kind === "livewatch-search") return resolveLivewatchSearchSource(channelKey, sourceName, source);
  if (source.kind === "clouding") return resolveCloudingSource(channelKey, sourceName, source);
  if (source.kind === "lovetier") return resolveLovetierSource(channelKey, sourceName, source);
  return resolveLivewatchSource(channelKey, sourceName, source);
}

async function resolveAutoSource(channelKey, channel, requestUrl) {
  const failures = [];
  const cached = readCache(channelKey, "auto", requestUrl, channel);
  if (cached?.source) {
    try {
      const resolved = await resolveSource(channelKey, channel, cached.source);
      return { ...resolved, detection: `cache-${cached.source}` };
    } catch (error) {
      failures.push(`${cached.source}:${error?.message || "error"}`);
    }
  }
  const order = parseOrder(requestUrl, channel);
  for (const sourceName of order) {
    try {
      const resolved = await resolveSource(channelKey, channel, sourceName);
      writeCache(channelKey, "auto", requestUrl, channel, { source: sourceName });
      return {
        ...resolved,
        detection: failures.length ? `auto-${sourceName}-after-${failures.length}-failure` : `auto-${sourceName}`
      };
    } catch (error) {
      failures.push(`${sourceName}:${error?.message || "error"}`);
    }
  }
  throw new Error(`no source (${failures.join(", ")})`);
}

async function resolveMode(channelKey, channel, mode, requestUrl) {
  if (mode === "auto") return resolveAutoSource(channelKey, channel, requestUrl);
  if (!allSources(channel)[mode]) throw new Error(`unknown mode ${mode}`);
  const resolved = await resolveSource(channelKey, channel, mode);
  return { ...resolved, detection: `forced-${mode}` };
}

function masterHeaders(channelKey, selected, mode) {
  const headers = new Headers(corsHeaders());
  headers.set("Content-Type", "application/vnd.apple.mpegurl");
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  headers.set("X-Livewatch-Smart-Channel", channelKey);
  headers.set("X-Livewatch-Smart-Mode", mode);
  headers.set("X-Livewatch-Smart-Source", selected.source);
  headers.set("X-Livewatch-Smart-Source-Id", selected.sourceId);
  headers.set("X-Livewatch-Smart-Detection", selected.detection);
  headers.set("X-Livewatch-Smart-Latency", `${selected.latencyMs}ms`);
  return headers;
}

async function handleMaster(request, requestUrl, channelKey, channel, mode) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
  }
  let selected;
  try {
    selected = await resolveMode(channelKey, channel, mode, requestUrl);
  } catch (error) {
    const headers = new Headers(corsHeaders());
    headers.set("Content-Type", "text/plain; charset=utf-8");
    return new Response(`${channel.label} source unavailable: ${error?.message || "unknown error"}`, {
      status: 502,
      headers
    });
  }
  const headers = masterHeaders(channelKey, selected, mode);
  if (request.method === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(rewritePlaylist(selected.masterText, selected.upstreamUrl, requestUrl.origin), {
    status: 200,
    headers
  });
}

async function handleProxy(request, requestUrl) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
  }
  const rawUrl = requestUrl.searchParams.get("url") || "";
  if (!rawUrl || rawUrl.length > 8192) {
    return new Response("Missing or invalid upstream URL", { status: 400, headers: corsHeaders() });
  }
  let upstreamUrl;
  try {
    upstreamUrl = new URL(rawUrl);
  } catch (_) {
    return new Response("Invalid upstream URL", { status: 400, headers: corsHeaders() });
  }
  if (!isAllowedProxyUrl(upstreamUrl)) {
    return new Response("Upstream not allowed", { status: 403, headers: corsHeaders() });
  }
  const upstreamHeadersForRequest = new Headers(upstreamHeaders(upstreamUrl, request.headers.get("Accept") || "*/*"));
  const range = request.headers.get("Range");
  if (range) upstreamHeadersForRequest.set("Range", range);
  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: upstreamHeadersForRequest,
      redirect: "follow"
    });
  } catch (error) {
    const headers = new Headers(corsHeaders());
    headers.set("Content-Type", "text/plain; charset=utf-8");
    return new Response(`Upstream fetch failed: ${error?.message || "network error"}`, {
      status: 502,
      headers
    });
  }
  const contentType = hlsContentType(upstreamUrl.pathname, upstream.headers.get("Content-Type"));
  const isPlaylist = request.method === "GET" && contentType.toLowerCase().includes("mpegurl");
  const headers = new Headers(corsHeaders());
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  for (const name of ["Accept-Ranges", "Content-Length", "Content-Range"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (isPlaylist) {
    headers.delete("Content-Length");
    return new Response(rewritePlaylist(await upstream.text(), upstreamUrl, requestUrl.origin), {
      status: upstream.status,
      statusText: upstream.statusText,
      headers
    });
  }
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers
  });
}

async function sourceStatus(channelKey, channel, sourceName) {
  const startedAt = Date.now();
  try {
    const resolved = await resolveSource(channelKey, channel, sourceName);
    return {
      source: sourceName,
      ok: true,
      sourceId: resolved.sourceId,
      latencyMs: Date.now() - startedAt,
      manifestLatencyMs: resolved.latencyMs,
      lines: resolved.masterText.split(/\r?\n/).length
    };
  } catch (error) {
    return {
      source: sourceName,
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error?.message || "unknown error"
    };
  }
}

async function handleStatus(request, channelKey, channel) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  const sourceNames = Object.keys(allSources(channel));
  const results = await Promise.all(sourceNames.map((sourceName) => sourceStatus(channelKey, channel, sourceName)));
  const headers = new Headers(corsHeaders());
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify({
    ok: true,
    generatedAt: new Date().toISOString(),
    channel: channelKey,
    label: channel.label,
    defaultOrder: channel.defaultOrder,
    smartOrder: smartDefaultOrder(channel),
    automaticSources: Object.keys(channel.sources || {}),
    manualSources: Object.keys(channel.manualSources || {}),
    availableSources: sourceNames,
    results
  }, null, 2), { status: 200, headers });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function playerPage(origin, channelKey, channel) {
  const sourceUrls = {};
  const sourceLabels = {};
  const sources = allSources(channel);
  const smartOrder = smartDefaultOrder(channel);
  for (const [key, source] of Object.entries(sources)) {
    sourceUrls[key] = `${origin}/api/live/${channelKey}/${key}/master.m3u8`;
    sourceLabels[key] = source.label;
  }
  const sourceButtons = Object.entries(sources).map(([key, source]) => {
    const className = channel.manualSources?.[key] ? ` class="secondary"` : "";
    return `<button data-source="${escapeHtml(key)}"${className}>${escapeHtml(source.button || source.label)}</button>`;
  }).join("\n        ");
  const channelOptions = Object.entries(CHANNELS).map(([key, value]) => {
    const selected = key === channelKey ? " selected" : "";
    return `<option value="${escapeHtml(key)}"${selected}>${escapeHtml(value.label)}</option>`;
  }).join("");
  const startLabel = `Smart ${smartOrder.join(" -> ")}`;
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(channel.label)} Smart LiveWatch</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #000; color: #e5edf7; font-family: Arial, sans-serif; }
    main { position: fixed; inset: 0; width: 100vw; height: 100vh; background: #000; }
    video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; background: #000; display: block; }
    #menuToggle { position: fixed; top: 10px; right: 10px; z-index: 30; width: 38px; height: 38px; padding: 0; display: grid; place-items: center; color: rgba(255,255,255,.9); background: rgba(0,0,0,.12); border: 1px solid rgba(255,255,255,.18); border-radius: 10px; cursor: pointer; backdrop-filter: blur(4px); }
    #menuPanel { position: fixed; top: 56px; right: 10px; z-index: 29; width: min(440px, calc(100vw - 20px)); max-height: calc(100vh - 66px); overflow: auto; padding: 14px; border: 1px solid rgba(255,255,255,.18); border-radius: 12px; background: rgba(5,7,11,.88); box-shadow: 0 14px 40px rgba(0,0,0,.4); backdrop-filter: blur(10px); }
    #menuPanel[hidden], #log[hidden] { display: none !important; }
    h1 { margin: 0 0 10px; font-size: 18px; }
    .info { margin: 0 0 10px; font-size: 12px; line-height: 1.45; color: #b8c7d9; }
    .bar { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 0; }
    button, a, select { color: #e5edf7; background: #0f2741; border: 1px solid #2d6f9f; border-radius: 7px; padding: 9px 11px; text-decoration: none; cursor: pointer; }
    button.secondary { background: #18202c; border-color: #52606f; }
    select { width: 100%; margin: 6px 0 8px; }
    pre { margin: 10px 0 0; min-height: 140px; max-height: 42vh; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; padding: 10px; background: #08111e; border: 1px solid #17324d; border-radius: 7px; font-size: 11px; }
  </style>
</head>
<body>
  <main>
    <video id="video" controls autoplay playsinline></video>
    <button id="menuToggle" type="button" aria-label="Ouvrir le menu" aria-controls="menuPanel" aria-expanded="false">☰</button>
    <section id="menuPanel" hidden>
      <h1>${escapeHtml(channel.label)} Smart LiveWatch</h1>
      <p class="info">Source active : <strong id="activeSourceInfo">initialisation</strong></p>
      <select id="channelSelect" aria-label="Chaine">${channelOptions}</select>
      <div class="bar">
        <button id="startSmart" type="button">${escapeHtml(startLabel)}</button>
        <button data-src="${escapeHtml(`${origin}/api/live/${channelKey}/master.m3u8`)}">Auto worker</button>
        ${sourceButtons}
        <a href="${escapeHtml(`${origin}/api/live/${channelKey}/health`)}" target="_blank" rel="noreferrer">Status JSON</a>
        <button id="toggleLog" class="secondary" type="button" aria-expanded="false">Afficher logs</button>
        <button id="copyLog" class="secondary" type="button">Copier logs</button>
        <button id="clearLog" class="secondary" type="button">Effacer logs</button>
      </div>
      <pre id="log" hidden></pre>
    </section>
  </main>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.6.16"><\/script>
  <script>
    const video = document.getElementById('video');
    const log = document.getElementById('log');
    const menuToggleButton = document.getElementById('menuToggle');
    const menuPanel = document.getElementById('menuPanel');
    const toggleLogButton = document.getElementById('toggleLog');
    const copyLogButton = document.getElementById('copyLog');
    const clearLogButton = document.getElementById('clearLog');
    const activeSourceInfo = document.getElementById('activeSourceInfo');
    const channelSelect = document.getElementById('channelSelect');
    const startSmartButton = document.getElementById('startSmart');
    video.defaultMuted = false;
    video.muted = false;
    video.volume = 1;
    const SOURCE_URLS = ${scriptJson(sourceUrls)};
    const SOURCE_LABELS = ${scriptJson(sourceLabels)};
    const START_SEQUENCE = ${scriptJson(smartOrder)};
    const START_LABEL = ${scriptJson(startLabel)};
    const CONSOLE_PREFIX = ${scriptJson(`${channel.label} Smart`)};
    const LONG_STALL_MS = 3500;
    const BAD_EVENT_WINDOW_MS = 30000;
    const BAD_EVENT_LIMIT = 2;
    const SMART_RECOVERY_PROBE_MS = 25000;
    const SMART_RECOVERY_CONFIRM_MS = 12000;
    const SMART_RETURN_COOLDOWN_MS = 60000;
    const SMART_FAILURE_HISTORY_MS = 600000;
    const SMART_FAILURE_BACKOFF_MS = 35000;
    const SMART_MAX_RECOVERY_WAIT_MS = 180000;
    const SMART_SELF_RETRY_MS = 12000;
    const SMART_SELF_RETRY_BACKOFF_MS = 8000;
    const SMART_SELF_RETRY_MAX_MS = 45000;
    const logs = [];
    let hls = null;
    let activeLabel = 'auto';
    let activeKey = '';
    let activeSrc = '';
    let activeSequence = [];
    let activeSequenceIndex = 0;
    let failoverLockUntil = 0;
    let lastProgressLogAt = 0;
    let stallStartedAt = 0;
    let stallTimer = null;
    let badEvents = [];
    let smartRecoveryTimer = null;
    let smartReturnConfirmTimer = null;
    let smartSelfRetryTimer = null;
    let smartSelfRetryCount = 0;
    let smartProbeInFlight = false;
    let smartRecoveryEpoch = 0;
    let pendingFailoverTimer = null;
    let lastSourceFailureAt = {};
    let lastSourceReturnAt = {};
    let sourceFailureHistory = {};
    let lastFragUrl = '';
    let sameFragCount = 0;
    function safeJson(value) { try { return JSON.stringify(value); } catch (_) { return String(value); } }
    function appendLog(event, details) {
      const suffix = details === undefined ? '' : ' ' + (typeof details === 'string' ? details : safeJson(details));
      const line = '[' + new Date().toISOString() + '] [' + activeLabel + '] ' + event + suffix;
      logs.push(line);
      if (logs.length > 900) logs.shift();
      log.textContent = logs.join('\\n');
      log.scrollTop = log.scrollHeight;
      console.log('[' + CONSOLE_PREFIX + ']', event, details || '');
    }
    function attemptAutoplay(context) {
      video.defaultMuted = false;
      video.muted = false;
      video.volume = 1;
      const result = video.play();
      if (result && typeof result.catch === 'function') {
        result.catch(function(error) { appendLog('autoplay-unmute-blocked', { context: context || 'play', message: error.message }); });
      }
    }
    function bufferedEnd() {
      try {
        if (!video.buffered || !video.buffered.length) return null;
        return Number(video.buffered.end(video.buffered.length - 1).toFixed(2));
      } catch (_) {
        return null;
      }
    }
    function clearStallTimer() {
      if (stallTimer) {
        clearTimeout(stallTimer);
        stallTimer = null;
      }
    }
    function clearSmartRecoveryTimers() {
      smartProbeInFlight = false;
      if (smartRecoveryTimer) {
        clearTimeout(smartRecoveryTimer);
        smartRecoveryTimer = null;
      }
      if (smartReturnConfirmTimer) {
        clearTimeout(smartReturnConfirmTimer);
        smartReturnConfirmTimer = null;
      }
    }
    function clearSelfRetryTimer() {
      if (smartSelfRetryTimer) {
        clearTimeout(smartSelfRetryTimer);
        smartSelfRetryTimer = null;
      }
    }
    function clearPendingFailoverTimer() {
      if (pendingFailoverTimer) {
        clearTimeout(pendingFailoverTimer);
        pendingFailoverTimer = null;
      }
    }
    function hasBetterSource() {
      return activeSequence.length > 1 && activeSequenceIndex > 0;
    }
    function betterSourceKeys() {
      if (!hasBetterSource()) return [];
      return activeSequence.slice(0, activeSequenceIndex).filter(function(key) {
        return SOURCE_URLS[key];
      });
    }
    function recentFailureTimes(key) {
      const now = Date.now();
      const history = sourceFailureHistory[key] || [];
      const recent = history.filter(function(time) {
        return now - time <= SMART_FAILURE_HISTORY_MS;
      });
      sourceFailureHistory[key] = recent;
      return recent;
    }
    function noteSourceFailureHistory(key, now) {
      const recent = recentFailureTimes(key);
      recent.push(now);
      sourceFailureHistory[key] = recent;
      return recent.length;
    }
    function sourceRecoveryDelayMs(key) {
      const count = recentFailureTimes(key).length;
      const backoff = Math.max(0, count - 1) * SMART_FAILURE_BACKOFF_MS;
      return Math.min(SMART_MAX_RECOVERY_WAIT_MS, SMART_RECOVERY_PROBE_MS + backoff);
    }
    function appendProbeParam(src) { return src + (src.indexOf('?') === -1 ? '?' : '&') + 'smartProbe=' + Date.now(); }
    function firstPlayableUrlFromPlaylist(text, baseSrc) {
      const lines = String(text || '').split(/\\r?\\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const trimmed = lines[index].trim();
        if (!trimmed || trimmed.charAt(0) === '#') continue;
        try { return new URL(trimmed, baseSrc).href; } catch (_) { return trimmed; }
      }
      return '';
    }
    async function probeSourceKey(key) {
      const source = SOURCE_URLS[key];
      if (!source) return false;
      const src = appendProbeParam(source);
      const startedAt = Date.now();
      try {
        const response = await fetch(src, { cache: 'no-store' });
        const text = await response.text();
        if (!response.ok || text.indexOf('#EXTM3U') === -1) {
          appendLog('smart-probe-master-bad', { key: key, status: response.status, latencyMs: Date.now() - startedAt });
          return false;
        }
        const firstUrl = firstPlayableUrlFromPlaylist(text, response.url || src);
        if (firstUrl) {
          const mediaResponse = await fetch(appendProbeParam(firstUrl), { cache: 'no-store', headers: { Range: 'bytes=0-2047' } });
          if (mediaResponse.body && mediaResponse.body.cancel) mediaResponse.body.cancel();
          if (!mediaResponse.ok && mediaResponse.status !== 206) {
            appendLog('smart-probe-media-bad', { key: key, status: mediaResponse.status, latencyMs: Date.now() - startedAt });
            return false;
          }
        }
        appendLog('smart-probe-ok', { key: key, latencyMs: Date.now() - startedAt });
        return true;
      } catch (error) {
        appendLog('smart-probe-error', { key: key, message: error.message });
        return false;
      }
    }
    function markSourceFailure(key, reason) {
      if (!activeSequence.length || !key) return;
      const now = Date.now();
      lastSourceFailureAt[key] = now;
      const recentFailures = noteSourceFailureHistory(key, now);
      clearSmartRecoveryTimers();
      appendLog('smart-source-failure', {
        key: key,
        reason: reason,
        recentFailures: recentFailures,
        retryAfterMs: sourceRecoveryDelayMs(key)
      });
    }
    async function attemptPrimaryReturn(reason) {
      smartRecoveryTimer = null;
      if (!hasBetterSource()) return;
      const attemptEpoch = smartRecoveryEpoch;
      const now = Date.now();
      const candidates = betterSourceKeys();
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const lastFailure = lastSourceFailureAt[candidate] || 0;
        const lastReturn = lastSourceReturnAt[candidate] || 0;
        const recoveryDelayMs = sourceRecoveryDelayMs(candidate);
        const recentFailures = recentFailureTimes(candidate).length;
        if (now - lastReturn < SMART_RETURN_COOLDOWN_MS) {
          appendLog('smart-better-candidate-cooldown', {
            candidate: candidate,
            recentFailures: recentFailures,
            remainingMs: SMART_RETURN_COOLDOWN_MS - (now - lastReturn)
          });
          continue;
        }
        if (now - lastFailure < recoveryDelayMs) {
          appendLog('smart-better-candidate-recent-failure', {
            candidate: candidate,
            recentFailures: recentFailures,
            remainingMs: recoveryDelayMs - (now - lastFailure)
          });
          continue;
        }
        appendLog('smart-better-probe-start', {
          candidate: candidate,
          current: activeKey,
          reason: reason
        });
        smartProbeInFlight = true;
        const firstProbeOk = await probeSourceKey(candidate);
        smartProbeInFlight = false;
        if (attemptEpoch !== smartRecoveryEpoch || !hasBetterSource()) return;
        if (!firstProbeOk) {
          lastSourceFailureAt[candidate] = Date.now();
          noteSourceFailureHistory(candidate, lastSourceFailureAt[candidate]);
          continue;
        }
        appendLog('smart-better-confirm-wait', {
          candidate: candidate,
          confirmMs: SMART_RECOVERY_CONFIRM_MS
        });
        const confirmEpoch = attemptEpoch;
        smartReturnConfirmTimer = setTimeout(async function() {
          smartReturnConfirmTimer = null;
          if (confirmEpoch !== smartRecoveryEpoch) return;
          if (!hasBetterSource() || activeSequence.indexOf(candidate) >= activeSequenceIndex) return;
          smartProbeInFlight = true;
          const secondProbeOk = await probeSourceKey(candidate);
          smartProbeInFlight = false;
          if (confirmEpoch !== smartRecoveryEpoch || !hasBetterSource()) return;
          if (!secondProbeOk) {
            lastSourceFailureAt[candidate] = Date.now();
            noteSourceFailureHistory(candidate, lastSourceFailureAt[candidate]);
            schedulePrimaryRecovery('better-confirm-failed-' + candidate);
            return;
          }
          lastSourceReturnAt[candidate] = Date.now();
          loadSourceKey(
            candidate,
            'Smart return ' + SOURCE_LABELS[candidate],
            activeSequence,
            activeSequence.indexOf(candidate),
            'smart-return-' + reason
          );
        }, SMART_RECOVERY_CONFIRM_MS);
        return;
      }
      schedulePrimaryRecovery('no-better-ready-' + reason);
    }
    function recoveryWaitMs() {
      if (!hasBetterSource()) return 0;
      const now = Date.now();
      const candidates = betterSourceKeys();
      let waitMs = SMART_RECOVERY_PROBE_MS;
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const lastFailure = lastSourceFailureAt[candidate] || 0;
        const lastReturn = lastSourceReturnAt[candidate] || 0;
        const recoveryDelayMs = sourceRecoveryDelayMs(candidate);
        const candidateWaitMs = Math.max(
          5000,
          recoveryDelayMs - Math.max(0, now - lastFailure),
          SMART_RETURN_COOLDOWN_MS - Math.max(0, now - lastReturn)
        );
        waitMs = Math.min(waitMs, candidateWaitMs);
      }
      return Math.max(5000, waitMs);
    }
    function schedulePrimaryRecovery(reason) {
      if (!hasBetterSource() || smartRecoveryTimer || smartReturnConfirmTimer || smartProbeInFlight) return;
      const waitMs = recoveryWaitMs();
      appendLog('smart-better-recovery-scheduled', {
        reason: reason,
        current: activeKey,
        candidates: betterSourceKeys(),
        waitMs: waitMs
      });
      smartRecoveryTimer = setTimeout(function() { attemptPrimaryReturn(reason || 'scheduled'); }, waitMs);
    }
    function scheduleSelfRetry(reason) {
      if (!activeKey || !SOURCE_URLS[activeKey] || smartSelfRetryTimer) return;
      smartSelfRetryCount += 1;
      const waitMs = Math.min(
        SMART_SELF_RETRY_MAX_MS,
        SMART_SELF_RETRY_MS + Math.max(0, smartSelfRetryCount - 1) * SMART_SELF_RETRY_BACKOFF_MS
      );
      appendLog('smart-self-retry-scheduled', {
        reason: reason,
        key: activeKey,
        attempt: smartSelfRetryCount,
        waitMs: waitMs
      });
      smartSelfRetryTimer = setTimeout(function() {
        smartSelfRetryTimer = null;
        if (!activeKey || !SOURCE_URLS[activeKey]) return;
        loadSourceKey(
          activeKey,
          'Smart retry ' + SOURCE_LABELS[activeKey],
          activeSequence && activeSequence.length ? activeSequence : [activeKey],
          activeSequenceIndex,
          'self-retry-' + reason
        );
      }, waitMs);
    }
    function noteRecovered(eventName) {
      if (!stallStartedAt) return;
      appendLog('stall-recovered', { event: eventName, durationMs: Date.now() - stallStartedAt, currentTime: Number(video.currentTime.toFixed(2)), bufferedEnd: bufferedEnd() });
      stallStartedAt = 0;
      clearStallTimer();
    }
    function tryFailover(reason) {
      const now = Date.now();
      if (now < failoverLockUntil) {
        if (!pendingFailoverTimer) {
          const waitMs = Math.max(120, failoverLockUntil - now + 60);
          appendLog('failover-delayed', { reason: reason, activeKey: activeKey, waitMs: waitMs });
          pendingFailoverTimer = setTimeout(function() {
            pendingFailoverTimer = null;
            tryFailover('delayed-' + reason);
          }, waitMs);
        }
        return;
      }
      clearPendingFailoverTimer();
      if (!activeSequence.length || activeSequenceIndex >= activeSequence.length - 1) {
        failoverLockUntil = Date.now() + 3000;
        appendLog('failover-unavailable', { reason: reason, activeKey: activeKey, sequence: activeSequence });
        markSourceFailure(activeKey, reason);
        scheduleSelfRetry(reason);
        return;
      }
      failoverLockUntil = Date.now() + 3000;
      const from = activeKey;
      markSourceFailure(from, reason);
      const nextIndex = activeSequenceIndex + 1;
      const nextKey = activeSequence[nextIndex];
      appendLog('failover-switch', { reason: reason, from: from, to: nextKey, sequence: activeSequence });
      loadSourceKey(nextKey, 'Auto failover ' + SOURCE_LABELS[nextKey], activeSequence, nextIndex, reason);
      schedulePrimaryRecovery('after-failover-' + reason);
    }
    function noteStall(eventName) {
      if (!stallStartedAt) {
        stallStartedAt = Date.now();
        appendLog('stall-start', { event: eventName, currentTime: Number(video.currentTime.toFixed(2)), bufferedEnd: bufferedEnd() });
      }
      clearStallTimer();
      stallTimer = setTimeout(function() { tryFailover('stall-timeout-' + eventName); }, LONG_STALL_MS);
    }
    function recordBadEvent(kind, details) {
      const now = Date.now();
      badEvents.push(now);
      badEvents = badEvents.filter(function(time) { return now - time <= BAD_EVENT_WINDOW_MS; });
      appendLog('bad-event-count', { kind: kind, count: badEvents.length, limit: BAD_EVENT_LIMIT, details: details || null });
      if (badEvents.length >= BAD_EVENT_LIMIT) tryFailover('repeated-' + kind);
    }
    async function inspectSource(src) {
      try {
        const response = await fetch(src, { method: 'HEAD', cache: 'no-store' });
        appendLog('source-head', {
          status: response.status,
          channel: response.headers.get('X-Livewatch-Smart-Channel'),
          mode: response.headers.get('X-Livewatch-Smart-Mode'),
          source: response.headers.get('X-Livewatch-Smart-Source'),
          sourceId: response.headers.get('X-Livewatch-Smart-Source-Id'),
          detection: response.headers.get('X-Livewatch-Smart-Detection'),
          latency: response.headers.get('X-Livewatch-Smart-Latency')
        });
      } catch (error) {
        appendLog('source-head-error', error.message);
      }
    }
    function copyLogs() {
      const text = logs.join('\\n') || 'Aucun log.';
      const done = function() {
        const previous = copyLogButton.textContent;
        copyLogButton.textContent = 'Copie OK';
        setTimeout(function() { copyLogButton.textContent = previous; }, 1200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function(error) { appendLog('copy-error', error.message); });
      } else {
        const area = document.createElement('textarea');
        area.value = text;
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
        done();
      }
    }
    async function load(src, label) {
      activeLabel = label || 'source';
      activeSrc = src;
      lastProgressLogAt = 0;
      stallStartedAt = 0;
      badEvents = [];
      lastFragUrl = '';
      sameFragCount = 0;
      clearStallTimer();
      appendLog('load-start', src);
      inspectSource(src);
      if (hls) { hls.destroy(); hls = null; }
      video.loop = false;
      video.removeAttribute('src');
      video.load();
      if (window.Hls && Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 7,
          maxBufferLength: 18,
          manifestLoadingTimeOut: 8000,
          levelLoadingTimeOut: 8000,
          fragLoadingTimeOut: 10000
        });
        hls.on(Hls.Events.MANIFEST_PARSED, function(_, data) {
          appendLog('manifest-ok', { levels: data.levels ? data.levels.length : 0, heights: data.levels ? data.levels.map(function(level) { return level.height || 0; }) : [] });
          attemptAutoplay('manifest-parsed');
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, function(_, data) {
          const level = hls && hls.levels ? hls.levels[data.level] : null;
          appendLog('level-switched', { level: data.level, height: level ? level.height : null, bitrate: level ? level.bitrate : null });
        });
        hls.on(Hls.Events.FRAG_CHANGED, function(_, data) {
          const frag = data.frag || {};
          const fragUrl = frag.url || frag.relurl || '';
          if (fragUrl && fragUrl === lastFragUrl) {
            sameFragCount += 1;
          } else {
            lastFragUrl = fragUrl;
            sameFragCount = 0;
          }
          if (sameFragCount >= 2) {
            recordBadEvent('sameFragRepeated', {
              frag: frag.sn || fragUrl,
              count: sameFragCount
            });
          }
        });
        hls.on(Hls.Events.ERROR, function(_, data) {
          const summary = { type: data.type, details: data.details, fatal: data.fatal, status: data.response ? data.response.code : null };
          appendLog('hls-error', summary);
          if (data.fatal) {
            tryFailover('fatal-hls-' + (data.details || data.type || 'error'));
            return;
          }
          if (['bufferStalledError', 'bufferNudgeOnStall', 'fragLoadError', 'fragLoadTimeOut', 'levelLoadError', 'levelLoadTimeOut'].indexOf(data.details) !== -1) {
            recordBadEvent(data.details, summary);
          }
        });
        hls.loadSource(src);
        hls.attachMedia(video);
      } else {
        video.src = src;
        attemptAutoplay('native-source');
      }
    }
    function loadSourceKey(key, label, sequence, index, reason) {
      smartRecoveryEpoch += 1;
      clearSelfRetryTimer();
      clearPendingFailoverTimer();
      activeLabel = label || SOURCE_LABELS[key];
      activeKey = key;
      activeSequence = sequence && sequence.length ? sequence.slice() : [key];
      activeSequenceIndex = typeof index === 'number' ? index : activeSequence.indexOf(key);
      if (activeSequenceIndex < 0) activeSequenceIndex = 0;
      if (String(reason || '').indexOf('self-retry-') !== 0) smartSelfRetryCount = 0;
      if (activeSourceInfo) activeSourceInfo.textContent = SOURCE_LABELS[key] + ' (' + key + ')';
      appendLog('source-selected', { key: key, label: SOURCE_LABELS[key], reason: reason || 'manual', sequence: activeSequence });
      if (hasBetterSource()) {
        schedulePrimaryRecovery('source-selected-' + (reason || 'manual'));
      } else {
        clearSmartRecoveryTimers();
      }
      load(SOURCE_URLS[key], label || SOURCE_LABELS[key]);
    }
    function startSequence(sequence, label) {
      const clean = sequence.filter(function(key) { return SOURCE_URLS[key]; });
      if (!clean.length) return;
      loadSourceKey(clean[0], label + ' -> ' + SOURCE_LABELS[clean[0]], clean, 0, 'sequence-start');
    }
    function sequenceFromSource(key) {
      const base = START_SEQUENCE && START_SEQUENCE.length ? START_SEQUENCE : [key];
      const startAt = base.indexOf(key);
      if (startAt < 0) return [key].filter(function(value) { return SOURCE_URLS[value]; });
      return base.slice(startAt).filter(function(value) { return SOURCE_URLS[value]; });
    }
    ['loadstart', 'loadedmetadata', 'playing', 'waiting', 'stalled', 'pause', 'ended', 'error'].forEach(function(name) {
      video.addEventListener(name, function() {
        appendLog('video-' + name, { currentTime: Number(video.currentTime.toFixed(2)), bufferedEnd: bufferedEnd(), paused: video.paused, muted: video.muted, volume: video.volume });
        if (name === 'waiting' || name === 'stalled') noteStall(name);
        if (name === 'playing' || name === 'loadedmetadata') {
          if (name === 'playing') smartSelfRetryCount = 0;
          noteRecovered(name);
          if (hasBetterSource()) schedulePrimaryRecovery('fallback-' + name);
        }
        if (name === 'ended' || name === 'error') tryFailover('video-' + name);
      });
    });
    video.addEventListener('timeupdate', function() {
      const now = Date.now();
      if (now - lastProgressLogAt < 10000) return;
      lastProgressLogAt = now;
      appendLog('progress', { currentTime: Number(video.currentTime.toFixed(2)), bufferedEnd: bufferedEnd(), source: activeSrc });
      noteRecovered('timeupdate');
      if (hasBetterSource()) schedulePrimaryRecovery('fallback-progress');
    });
    startSmartButton.addEventListener('click', function() { startSequence(START_SEQUENCE, START_LABEL); });
    document.querySelectorAll('button[data-source]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const key = btn.dataset.source;
        loadSourceKey(key, btn.textContent.trim(), sequenceFromSource(key), 0, 'manual');
      });
    });
    document.querySelectorAll('button[data-src]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        activeKey = 'worker-auto';
        activeSequence = [];
        activeSequenceIndex = 0;
        if (activeSourceInfo) activeSourceInfo.textContent = btn.textContent.trim();
        load(btn.dataset.src, btn.textContent.trim());
      });
    });
    channelSelect.addEventListener('change', function() {
      location.href = '/?channel=' + encodeURIComponent(channelSelect.value);
    });
    menuToggleButton.addEventListener('click', function() {
      const willOpen = menuPanel.hidden;
      menuPanel.hidden = !willOpen;
      menuToggleButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      menuToggleButton.setAttribute('aria-label', willOpen ? 'Fermer le menu' : 'Ouvrir le menu');
    });
    toggleLogButton.addEventListener('click', function() {
      const willShow = log.hidden;
      log.hidden = !willShow;
      toggleLogButton.textContent = willShow ? 'Masquer logs' : 'Afficher logs';
      toggleLogButton.setAttribute('aria-expanded', willShow ? 'true' : 'false');
      if (willShow) log.scrollTop = log.scrollHeight;
    });
    document.addEventListener('pointerdown', function unlockPlayback() {
      if (video.paused) attemptAutoplay('first-user-gesture');
      document.removeEventListener('pointerdown', unlockPlayback);
    }, { once: true });
    copyLogButton.addEventListener('click', copyLogs);
    clearLogButton.addEventListener('click', function() {
      logs.length = 0;
      log.textContent = '';
      appendLog('log-cleared');
    });
    appendLog('lab-ready', location.href);
    startSequence(START_SEQUENCE, START_LABEL);
  <\/script>
</body>
</html>`;
}

function jsonResponse(value, status = 200) {
  const headers = new Headers(corsHeaders());
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(value, null, 2), { status, headers });
}

function notFound(message) {
  return new Response(message, {
    status: 404,
    headers: corsHeaders()
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.toLowerCase();
    if (path === PROXY_PATH) return handleProxy(request, url);
    if (path === "/api/channels") {
      return jsonResponse(Object.entries(CHANNELS).map(([key, channel]) => ({
        key,
        label: channel.label,
        defaultOrder: channel.defaultOrder,
        smartOrder: smartDefaultOrder(channel),
        automaticSources: Object.keys(channel.sources || {}),
        manualSources: Object.keys(channel.manualSources || {}),
        sources: Object.keys(allSources(channel))
      })));
    }

    const route = path.match(/^\/api\/live\/([^/]+)(?:\/([^/]+))?(?:\/master\.m3u8|\/health)?$/);
    if (route) {
      const channelHit = getChannel(route[1]);
      if (!channelHit) return notFound("Unknown channel");
      const mode = route[2] || (path.endsWith("/health") ? "health" : "auto");
      if (mode === "health") return handleStatus(request, channelHit.key, channelHit.config);
      return handleMaster(request, url, channelHit.key, channelHit.config, mode === "master.m3u8" ? "auto" : mode);
    }

    if (path === "/" || path === "/index.html") {
      const channelHit = getChannel(url.searchParams.get("channel") || "cmtv") || getChannel("cmtv");
      const headers = new Headers(corsHeaders());
      headers.set("Content-Type", "text/html; charset=utf-8");
      headers.set("Cache-Control", "no-store");
      return new Response(playerPage(url.origin, channelHit.key, channelHit.config), { status: 200, headers });
    }

    return notFound("LiveWatch smart: not found");
  }
};
