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
      'Search "Lowboy trailer 53 ton"',
      'Ask "Best semi truck for long haul?"',
      'Search "Peterbilt 389 sleeper under $80k"',
      'Ask "How many tons can a lowboy haul?"',
      'Search "Kenworth T680 under $90k"',
      'Ask "What to inspect on a used semi truck?"',
    ],
    exampleSearches: [
      'Lowboy trailer 50 ton under $60k',
      'Peterbilt 389 sleeper truck',
      'What to check before buying a used semi?',
      'Kenworth T680 daycab under $90k',
      'How much does a 3-axle lowboy trailer cost?',
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
      'Buscar "Remolque lowboy 53 toneladas"',
      'Preguntar "¿Mejor camión semi para larga distancia?"',
      'Buscar "Peterbilt 389 dormitorio menos de $80k"',
      'Preguntar "¿Cuántas toneladas puede cargar un lowboy?"',
      'Buscar "Kenworth T680 menos de $90k"',
      'Preguntar "¿Qué revisar en un semi usado?"',
    ],
    exampleSearches: [
      'Remolque lowboy 50 toneladas menos de $60k',
      'Peterbilt 389 camión dormitorio',
      '¿Qué revisar antes de comprar un semi usado?',
      'Kenworth T680 daycab menos de $90k',
      '¿Cuánto cuesta un remolque lowboy de 3 ejes?',
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
      'Rechercher "Remorque surbaissée 53 tonnes"',
      'Demander "Meilleur semi-remorque pour longue distance?"',
      'Rechercher "Peterbilt 389 couchette moins de 80k$"',
      'Demander "Combien de tonnes un lowboy peut-il transporter?"',
      'Rechercher "Kenworth T680 moins de 90k$"',
      'Demander "Que vérifier sur un semi d\'occasion?"',
    ],
    exampleSearches: [
      'Remorque surbaissée 50 tonnes moins de 60k$',
      'Peterbilt 389 camion couchette',
      'Que vérifier avant d\'acheter un semi d\'occasion?',
      'Kenworth T680 daycab moins de 90k$',
      'Combien coûte une remorque surbaissée 3 essieux?',
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
      'Suchen "Tieflader 53 Tonnen"',
      'Fragen "Bester Sattelzug für Langstrecke?"',
      'Suchen "Peterbilt 389 Schlafkabine unter 80k$"',
      'Fragen "Wie viele Tonnen kann ein Tieflader transportieren?"',
      'Suchen "Kenworth T680 unter 90k$"',
      'Fragen "Was bei einem gebrauchten Sattelzug prüfen?"',
    ],
    exampleSearches: [
      'Tieflader 50 Tonnen unter 60k$',
      'Peterbilt 389 Schlafkabinen-LKW',
      'Was vor dem Kauf eines gebrauchten Sattelzugs prüfen?',
      'Kenworth T680 Day Cab unter 90k$',
      'Was kostet ein 3-Achsen-Tieflader?',
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
      'Pesquisar "Reboque lowboy 53 toneladas"',
      'Perguntar "Melhor caminhão semi para longa distância?"',
      'Pesquisar "Peterbilt 389 dormitório abaixo de $80k"',
      'Perguntar "Quantas toneladas um lowboy pode transportar?"',
      'Pesquisar "Kenworth T680 abaixo de $90k"',
      'Perguntar "O que verificar em um semi usado?"',
    ],
    exampleSearches: [
      'Reboque lowboy 50 toneladas abaixo de $60k',
      'Peterbilt 389 caminhão dormitório',
      'O que verificar antes de comprar um semi usado?',
      'Kenworth T680 daycab abaixo de $90k',
      'Quanto custa um reboque lowboy de 3 eixos?',
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
      '搜索 "低板拖车 53吨"',
      '询问 "长途运输最好的半挂车?"',
      '搜索 "Peterbilt 389 卧铺 8万美元以下"',
      '询问 "低板拖车能拉多少吨?"',
      '搜索 "Kenworth T680 9万美元以下"',
      '询问 "购买二手半挂车要检查什么?"',
    ],
    exampleSearches: [
      '低板拖车50吨 6万美元以下',
      'Peterbilt 389 卧铺卡车',
      '购买二手半挂车前要检查什么?',
      'Kenworth T680 日间驾驶室 9万美元以下',
      '3轴低板拖车多少钱?',
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
      '検索 "ローボーイトレーラー 53トン"',
      '質問 "長距離に最適なセミトラックは?"',
      '検索 "Peterbilt 389 スリーパー 8万ドル以下"',
      '質問 "ローボーイは何トン積載できる?"',
      '検索 "Kenworth T680 9万ドル以下"',
      '質問 "中古セミトラックの点検ポイントは?"',
    ],
    exampleSearches: [
      'ローボーイトレーラー50トン 6万ドル以下',
      'Peterbilt 389 スリーパートラック',
      '中古セミトラック購入前の確認事項は?',
      'Kenworth T680 デイキャブ 9万ドル以下',
      '3軸ローボーイトレーラーの価格は?',
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
      '검색 "로보이 트레일러 53톤"',
      '질문 "장거리 운송에 가장 좋은 세미 트럭은?"',
      '검색 "Peterbilt 389 슬리퍼 8만 달러 이하"',
      '질문 "로보이는 몇 톤까지 운반할 수 있나요?"',
      '검색 "Kenworth T680 9만 달러 이하"',
      '질문 "중고 세미 트럭 점검 사항은?"',
    ],
    exampleSearches: [
      '로보이 트레일러 50톤 6만 달러 이하',
      'Peterbilt 389 슬리퍼 트럭',
      '중고 세미 트럭 구매 전 확인 사항은?',
      'Kenworth T680 데이캡 9만 달러 이하',
      '3축 로보이 트레일러 가격은?',
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
      'ابحث "مقطورة لوبوي 53 طن"',
      'اسأل "أفضل شاحنة نصف مقطورة للمسافات الطويلة؟"',
      'ابحث "Peterbilt 389 نائم أقل من 80 ألف دولار"',
      'اسأل "كم طن يمكن أن يحمل اللوبوي؟"',
      'ابحث "Kenworth T680 أقل من 90 ألف دولار"',
      'اسأل "ما الذي يجب فحصه في شاحنة سيمي مستعملة؟"',
    ],
    exampleSearches: [
      'مقطورة لوبوي 50 طن أقل من 60 ألف دولار',
      'Peterbilt 389 شاحنة نائم',
      'ما الذي يجب فحصه قبل شراء شاحنة سيمي مستعملة؟',
      'Kenworth T680 داي كاب أقل من 90 ألف دولار',
      'كم تكلفة مقطورة لوبوي 3 محاور؟',
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
      'Искать "Низкорамный прицеп 53 тонны"',
      'Спросить "Лучший тягач для дальних перевозок?"',
      'Искать "Peterbilt 389 спальник до $80k"',
      'Спросить "Сколько тонн перевозит низкорамник?"',
      'Искать "Kenworth T680 до $90k"',
      'Спросить "Что проверить при покупке б/у тягача?"',
    ],
    exampleSearches: [
      'Низкорамный прицеп 50 тонн до $60k',
      'Peterbilt 389 тягач со спальником',
      'Что проверить перед покупкой б/у тягача?',
      'Kenworth T680 дневная кабина до $90k',
      'Сколько стоит 3-осный низкорамный прицеп?',
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
