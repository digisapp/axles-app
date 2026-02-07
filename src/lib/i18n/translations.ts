// Search bar translations for multiple languages
export type SupportedLocale = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'ja' | 'ko' | 'ar' | 'ru';

export interface SearchTranslations {
  placeholder: string;
  placeholderExamples: string[];
  exampleSearches: string[];
  questionStarters: string[];
  ui: {
    aiAssistant: string;
    suggestions: string;
    trySearching: string;
    searchListingsFor: string;
    browse: string;
  };
  categories: Record<string, string>;
}

export const translations: Record<SupportedLocale, SearchTranslations> = {
  en: {
    placeholder: 'Search or ask anything about trucks & trailers...',
    placeholderExamples: [
      'Search "Peterbilt 579 sleeper"',
      'Ask "What\'s a fair price for a 2020 Freightliner?"',
      'Search "Reefer trailers under $50k"',
      'Ask "What should I look for in a used semi?"',
      'Search "Lowboy trailers in Texas"',
      'Ask "Difference between day cab and sleeper?"',
    ],
    exampleSearches: [
      '2020 Peterbilt 579 under $100k',
      'Reefer trailer 53ft',
      'What should I look for in a used sleeper?',
      'Kenworth W900 day cab',
      'How much is a Freightliner Cascadia worth?',
    ],
    questionStarters: [
      'what', 'how', 'why', 'when', 'where', 'which', 'who',
      'should', 'can', 'could', 'would', 'is it', 'are there',
      'tell me', 'explain', 'help me', 'i need help',
      'difference between', 'compare'
    ],
    ui: {
      aiAssistant: 'Axlon',
      suggestions: 'Suggestions',
      trySearching: 'Try searching or asking',
      searchListingsFor: 'Search listings for',
      browse: 'Browse',
    },
    categories: {
      'trailers': 'All Trailers',
      'trucks': 'All Trucks',
      'reefer-trailers': 'Reefer Trailers',
      'dry-van-trailers': 'Dry Van Trailers',
      'flatbed-trailers': 'Flatbed Trailers',
      'lowboy-trailers': 'Lowboy Trailers',
      'sleeper-trucks': 'Sleeper Trucks',
      'day-cab-trucks': 'Day Cab Trucks',
      'heavy-duty-trucks': 'Heavy Duty Trucks',
      'dump-trucks': 'Dump Trucks',
      'excavators': 'Excavators',
      'loaders': 'Loaders',
    },
  },
  es: {
    placeholder: 'Buscar o preguntar sobre camiones y remolques...',
    placeholderExamples: [
      'Buscar "Peterbilt 579 dormitorio"',
      'Preguntar "¿Cuál es un precio justo para un Freightliner 2020?"',
      'Buscar "Remolques refrigerados menos de $50k"',
      'Preguntar "¿Qué debo buscar en un semi usado?"',
      'Buscar "Remolques lowboy en Texas"',
      'Preguntar "¿Diferencia entre day cab y sleeper?"',
    ],
    exampleSearches: [
      '2020 Peterbilt 579 menos de $100k',
      'Remolque refrigerado 53ft',
      '¿Qué debo buscar en un sleeper usado?',
      'Kenworth W900 day cab',
      '¿Cuánto vale un Freightliner Cascadia?',
    ],
    questionStarters: [
      'qué', 'cómo', 'por qué', 'cuándo', 'dónde', 'cuál', 'quién',
      'debería', 'puede', 'podría', 'es', 'hay',
      'dime', 'explica', 'ayúdame', 'necesito ayuda',
      'diferencia entre', 'comparar'
    ],
    ui: {
      aiAssistant: 'Axlon',
      suggestions: 'Sugerencias',
      trySearching: 'Intenta buscar o preguntar',
      searchListingsFor: 'Buscar listados para',
      browse: 'Explorar',
    },
    categories: {
      'trailers': 'Todos los Remolques',
      'trucks': 'Todos los Camiones',
      'reefer-trailers': 'Remolques Refrigerados',
      'dry-van-trailers': 'Remolques Secos',
      'flatbed-trailers': 'Remolques Planos',
      'lowboy-trailers': 'Remolques Lowboy',
      'sleeper-trucks': 'Camiones Dormitorio',
      'day-cab-trucks': 'Camiones Day Cab',
      'heavy-duty-trucks': 'Camiones de Servicio Pesado',
      'dump-trucks': 'Camiones Volquete',
      'excavators': 'Excavadoras',
      'loaders': 'Cargadores',
    },
  },
  fr: {
    placeholder: 'Rechercher ou poser des questions sur les camions et remorques...',
    placeholderExamples: [
      'Rechercher "Peterbilt 579 couchette"',
      'Demander "Quel est un prix juste pour un Freightliner 2020?"',
      'Rechercher "Remorques frigorifiques moins de 50k$"',
      'Demander "Que chercher dans un semi d\'occasion?"',
      'Rechercher "Remorques surbaissées au Texas"',
      'Demander "Différence entre day cab et couchette?"',
    ],
    exampleSearches: [
      '2020 Peterbilt 579 moins de 100k$',
      'Remorque frigorifique 53ft',
      'Que chercher dans une couchette d\'occasion?',
      'Kenworth W900 day cab',
      'Combien vaut un Freightliner Cascadia?',
    ],
    questionStarters: [
      'quel', 'comment', 'pourquoi', 'quand', 'où', 'lequel', 'qui',
      'devrais', 'peut', 'pourrait', 'est-ce', 'y a-t-il',
      'dis-moi', 'explique', 'aide-moi', 'j\'ai besoin d\'aide',
      'différence entre', 'comparer'
    ],
    ui: {
      aiAssistant: 'Axlon',
      suggestions: 'Suggestions',
      trySearching: 'Essayez de rechercher ou demander',
      searchListingsFor: 'Rechercher des annonces pour',
      browse: 'Parcourir',
    },
    categories: {
      'trailers': 'Toutes les Remorques',
      'trucks': 'Tous les Camions',
      'reefer-trailers': 'Remorques Frigorifiques',
      'dry-van-trailers': 'Remorques Sèches',
      'flatbed-trailers': 'Remorques Plateaux',
      'lowboy-trailers': 'Remorques Surbaissées',
      'sleeper-trucks': 'Camions Couchette',
      'day-cab-trucks': 'Camions Day Cab',
      'heavy-duty-trucks': 'Camions Lourds',
      'dump-trucks': 'Camions Bennes',
      'excavators': 'Excavatrices',
      'loaders': 'Chargeurs',
    },
  },
  de: {
    placeholder: 'Suchen oder fragen Sie nach LKWs und Anhängern...',
    placeholderExamples: [
      'Suchen "Peterbilt 579 Schlafkabine"',
      'Fragen "Was ist ein fairer Preis für einen 2020 Freightliner?"',
      'Suchen "Kühlanhänger unter 50k$"',
      'Fragen "Worauf sollte ich bei einem gebrauchten Sattelzug achten?"',
      'Suchen "Tieflader in Texas"',
      'Fragen "Unterschied zwischen Day Cab und Schlafkabine?"',
    ],
    exampleSearches: [
      '2020 Peterbilt 579 unter 100k$',
      'Kühlanhänger 53ft',
      'Worauf achten bei gebrauchter Schlafkabine?',
      'Kenworth W900 Day Cab',
      'Was ist ein Freightliner Cascadia wert?',
    ],
    questionStarters: [
      'was', 'wie', 'warum', 'wann', 'wo', 'welche', 'wer',
      'sollte', 'kann', 'könnte', 'ist es', 'gibt es',
      'sag mir', 'erkläre', 'hilf mir', 'ich brauche hilfe',
      'unterschied zwischen', 'vergleiche'
    ],
    ui: {
      aiAssistant: 'Axlon',
      suggestions: 'Vorschläge',
      trySearching: 'Versuchen Sie zu suchen oder zu fragen',
      searchListingsFor: 'Angebote suchen für',
      browse: 'Durchsuchen',
    },
    categories: {
      'trailers': 'Alle Anhänger',
      'trucks': 'Alle LKWs',
      'reefer-trailers': 'Kühlanhänger',
      'dry-van-trailers': 'Trockenfracht-Anhänger',
      'flatbed-trailers': 'Pritschenanhänger',
      'lowboy-trailers': 'Tieflader',
      'sleeper-trucks': 'Schlafkabinen-LKWs',
      'day-cab-trucks': 'Day Cab LKWs',
      'heavy-duty-trucks': 'Schwerlast-LKWs',
      'dump-trucks': 'Kipper',
      'excavators': 'Bagger',
      'loaders': 'Radlader',
    },
  },
  pt: {
    placeholder: 'Pesquisar ou perguntar sobre caminhões e reboques...',
    placeholderExamples: [
      'Pesquisar "Peterbilt 579 dormitório"',
      'Perguntar "Qual é um preço justo para um Freightliner 2020?"',
      'Pesquisar "Reboques refrigerados abaixo de $50k"',
      'Perguntar "O que procurar em um semi usado?"',
      'Pesquisar "Reboques lowboy no Texas"',
      'Perguntar "Diferença entre day cab e dormitório?"',
    ],
    exampleSearches: [
      '2020 Peterbilt 579 abaixo de $100k',
      'Reboque refrigerado 53ft',
      'O que procurar em um dormitório usado?',
      'Kenworth W900 day cab',
      'Quanto vale um Freightliner Cascadia?',
    ],
    questionStarters: [
      'o que', 'como', 'por que', 'quando', 'onde', 'qual', 'quem',
      'deveria', 'pode', 'poderia', 'é', 'há',
      'me diga', 'explique', 'me ajude', 'preciso de ajuda',
      'diferença entre', 'comparar'
    ],
    ui: {
      aiAssistant: 'Axlon',
      suggestions: 'Sugestões',
      trySearching: 'Tente pesquisar ou perguntar',
      searchListingsFor: 'Pesquisar anúncios para',
      browse: 'Navegar',
    },
    categories: {
      'trailers': 'Todos os Reboques',
      'trucks': 'Todos os Caminhões',
      'reefer-trailers': 'Reboques Refrigerados',
      'dry-van-trailers': 'Reboques Secos',
      'flatbed-trailers': 'Reboques Plataforma',
      'lowboy-trailers': 'Reboques Lowboy',
      'sleeper-trucks': 'Caminhões Dormitório',
      'day-cab-trucks': 'Caminhões Day Cab',
      'heavy-duty-trucks': 'Caminhões Pesados',
      'dump-trucks': 'Caminhões Basculantes',
      'excavators': 'Escavadeiras',
      'loaders': 'Carregadeiras',
    },
  },
  zh: {
    placeholder: '搜索或询问有关卡车和拖车的问题...',
    placeholderExamples: [
      '搜索 "Peterbilt 579 卧铺"',
      '询问 "2020年Freightliner的合理价格是多少?"',
      '搜索 "5万美元以下的冷藏拖车"',
      '询问 "购买二手半挂车应注意什么?"',
      '搜索 "德克萨斯州的低板拖车"',
      '询问 "日间驾驶室和卧铺有什么区别?"',
    ],
    exampleSearches: [
      '2020 Peterbilt 579 10万美元以下',
      '53英尺冷藏拖车',
      '购买二手卧铺应注意什么?',
      'Kenworth W900 日间驾驶室',
      'Freightliner Cascadia值多少钱?',
    ],
    questionStarters: [
      '什么', '如何', '为什么', '何时', '哪里', '哪个', '谁',
      '应该', '可以', '能否', '是否', '有没有',
      '告诉我', '解释', '帮我', '我需要帮助',
      '区别', '比较'
    ],
    ui: {
      aiAssistant: 'Axlon',
      suggestions: '建议',
      trySearching: '尝试搜索或提问',
      searchListingsFor: '搜索相关列表',
      browse: '浏览',
    },
    categories: {
      'trailers': '所有拖车',
      'trucks': '所有卡车',
      'reefer-trailers': '冷藏拖车',
      'dry-van-trailers': '干货拖车',
      'flatbed-trailers': '平板拖车',
      'lowboy-trailers': '低板拖车',
      'sleeper-trucks': '卧铺卡车',
      'day-cab-trucks': '日间驾驶室卡车',
      'heavy-duty-trucks': '重型卡车',
      'dump-trucks': '自卸卡车',
      'excavators': '挖掘机',
      'loaders': '装载机',
    },
  },
  ja: {
    placeholder: 'トラックやトレーラーについて検索または質問...',
    placeholderExamples: [
      '検索 "Peterbilt 579 スリーパー"',
      '質問 "2020年のFreightlinerの適正価格は?"',
      '検索 "5万ドル以下の冷凍トレーラー"',
      '質問 "中古セミを買う際の注意点は?"',
      '検索 "テキサスのローボーイトレーラー"',
      '質問 "デイキャブとスリーパーの違いは?"',
    ],
    exampleSearches: [
      '2020 Peterbilt 579 10万ドル以下',
      '53フィート冷凍トレーラー',
      '中古スリーパーで注意すべき点は?',
      'Kenworth W900 デイキャブ',
      'Freightliner Cascadiaの価値は?',
    ],
    questionStarters: [
      '何', 'どう', 'なぜ', 'いつ', 'どこ', 'どれ', '誰',
      'すべき', 'できる', 'でしょうか', 'ですか', 'ありますか',
      '教えて', '説明して', '助けて', '手伝って',
      '違い', '比較'
    ],
    ui: {
      aiAssistant: 'Axlon',
      suggestions: '提案',
      trySearching: '検索または質問してみてください',
      searchListingsFor: 'リストを検索',
      browse: '閲覧',
    },
    categories: {
      'trailers': 'すべてのトレーラー',
      'trucks': 'すべてのトラック',
      'reefer-trailers': '冷凍トレーラー',
      'dry-van-trailers': 'ドライバントレーラー',
      'flatbed-trailers': 'フラットベッドトレーラー',
      'lowboy-trailers': 'ローボーイトレーラー',
      'sleeper-trucks': 'スリーパートラック',
      'day-cab-trucks': 'デイキャブトラック',
      'heavy-duty-trucks': '大型トラック',
      'dump-trucks': 'ダンプトラック',
      'excavators': '掘削機',
      'loaders': 'ローダー',
    },
  },
  ko: {
    placeholder: '트럭과 트레일러에 대해 검색하거나 질문하세요...',
    placeholderExamples: [
      '검색 "Peterbilt 579 슬리퍼"',
      '질문 "2020 Freightliner의 적정 가격은?"',
      '검색 "5만 달러 이하 냉동 트레일러"',
      '질문 "중고 세미 구매 시 주의사항은?"',
      '검색 "텍사스의 로보이 트레일러"',
      '질문 "데이캡과 슬리퍼의 차이점은?"',
    ],
    exampleSearches: [
      '2020 Peterbilt 579 10만 달러 이하',
      '53피트 냉동 트레일러',
      '중고 슬리퍼 구매 시 주의사항은?',
      'Kenworth W900 데이캡',
      'Freightliner Cascadia 가치는?',
    ],
    questionStarters: [
      '무엇', '어떻게', '왜', '언제', '어디', '어느', '누구',
      '해야', '할 수', '될까', '인가', '있나',
      '알려줘', '설명해', '도와줘', '도움이 필요해',
      '차이', '비교'
    ],
    ui: {
      aiAssistant: 'Axlon',
      suggestions: '제안',
      trySearching: '검색하거나 질문해 보세요',
      searchListingsFor: '목록 검색',
      browse: '둘러보기',
    },
    categories: {
      'trailers': '모든 트레일러',
      'trucks': '모든 트럭',
      'reefer-trailers': '냉동 트레일러',
      'dry-van-trailers': '드라이밴 트레일러',
      'flatbed-trailers': '플랫베드 트레일러',
      'lowboy-trailers': '로보이 트레일러',
      'sleeper-trucks': '슬리퍼 트럭',
      'day-cab-trucks': '데이캡 트럭',
      'heavy-duty-trucks': '대형 트럭',
      'dump-trucks': '덤프 트럭',
      'excavators': '굴삭기',
      'loaders': '로더',
    },
  },
  ar: {
    placeholder: 'ابحث أو اسأل عن الشاحنات والمقطورات...',
    placeholderExamples: [
      'ابحث "Peterbilt 579 نائم"',
      'اسأل "ما هو السعر العادل لـ Freightliner 2020؟"',
      'ابحث "مقطورات مبردة أقل من 50 ألف دولار"',
      'اسأل "ما الذي يجب البحث عنه في شاحنة مستعملة؟"',
      'ابحث "مقطورات لوبوي في تكساس"',
      'اسأل "الفرق بين داي كاب والنائم؟"',
    ],
    exampleSearches: [
      '2020 Peterbilt 579 أقل من 100 ألف دولار',
      'مقطورة مبردة 53 قدم',
      'ما الذي يجب البحث عنه في نائم مستعمل؟',
      'Kenworth W900 داي كاب',
      'كم يساوي Freightliner Cascadia؟',
    ],
    questionStarters: [
      'ما', 'كيف', 'لماذا', 'متى', 'أين', 'أي', 'من',
      'هل يجب', 'هل يمكن', 'هل', 'أهناك',
      'أخبرني', 'اشرح', 'ساعدني', 'أحتاج مساعدة',
      'الفرق بين', 'قارن'
    ],
    ui: {
      aiAssistant: 'Axlon',
      suggestions: 'اقتراحات',
      trySearching: 'حاول البحث أو السؤال',
      searchListingsFor: 'البحث في القوائم عن',
      browse: 'تصفح',
    },
    categories: {
      'trailers': 'جميع المقطورات',
      'trucks': 'جميع الشاحنات',
      'reefer-trailers': 'مقطورات مبردة',
      'dry-van-trailers': 'مقطورات جافة',
      'flatbed-trailers': 'مقطورات مسطحة',
      'lowboy-trailers': 'مقطورات لوبوي',
      'sleeper-trucks': 'شاحنات نائمة',
      'day-cab-trucks': 'شاحنات داي كاب',
      'heavy-duty-trucks': 'شاحنات ثقيلة',
      'dump-trucks': 'شاحنات قلابة',
      'excavators': 'حفارات',
      'loaders': 'رافعات',
    },
  },
  ru: {
    placeholder: 'Искать или спрашивать о грузовиках и прицепах...',
    placeholderExamples: [
      'Искать "Peterbilt 579 спальник"',
      'Спросить "Какая справедливая цена для Freightliner 2020?"',
      'Искать "Рефрижераторы до $50k"',
      'Спросить "На что обратить внимание при покупке б/у тягача?"',
      'Искать "Низкорамные прицепы в Техасе"',
      'Спросить "Разница между дневной кабиной и спальником?"',
    ],
    exampleSearches: [
      '2020 Peterbilt 579 до $100k',
      'Рефрижератор 53 фута',
      'На что обратить внимание в б/у спальнике?',
      'Kenworth W900 дневная кабина',
      'Сколько стоит Freightliner Cascadia?',
    ],
    questionStarters: [
      'что', 'как', 'почему', 'когда', 'где', 'какой', 'кто',
      'стоит ли', 'можно ли', 'есть ли',
      'скажи', 'объясни', 'помоги', 'мне нужна помощь',
      'разница между', 'сравни'
    ],
    ui: {
      aiAssistant: 'Axlon',
      suggestions: 'Предложения',
      trySearching: 'Попробуйте искать или спросить',
      searchListingsFor: 'Искать объявления',
      browse: 'Просмотр',
    },
    categories: {
      'trailers': 'Все прицепы',
      'trucks': 'Все грузовики',
      'reefer-trailers': 'Рефрижераторы',
      'dry-van-trailers': 'Сухие фургоны',
      'flatbed-trailers': 'Бортовые прицепы',
      'lowboy-trailers': 'Низкорамные прицепы',
      'sleeper-trucks': 'Тягачи со спальником',
      'day-cab-trucks': 'Дневные кабины',
      'heavy-duty-trucks': 'Тяжелые грузовики',
      'dump-trucks': 'Самосвалы',
      'excavators': 'Экскаваторы',
      'loaders': 'Погрузчики',
    },
  },
};

// Detect user's preferred locale from browser
export function detectLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'en';

  const browserLang = navigator.language.toLowerCase();

  // Check for exact match first
  if (browserLang in translations) {
    return browserLang as SupportedLocale;
  }

  // Check for language code (e.g., 'en-US' -> 'en')
  const langCode = browserLang.split('-')[0];
  if (langCode in translations) {
    return langCode as SupportedLocale;
  }

  // Default to English
  return 'en';
}

// Get translations for a locale
export function getTranslations(locale?: SupportedLocale): SearchTranslations {
  const effectiveLocale = locale || detectLocale();
  return translations[effectiveLocale] || translations.en;
}
