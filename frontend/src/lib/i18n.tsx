"use client";

/**
 * Hand-rolled bilingual (English / हिन्दी) i18n.
 *
 * No external i18n library is used. A React context exposes the current
 * language, a setter (persisted to localStorage) and a `t(key)` lookup over a
 * nested dictionary using dot-notation keys (e.g. `t("nav.login")`).
 *
 * The two dictionaries are kept in exact structural sync: `hi` is typed as
 * `typeof en`, so a missing/renamed Hindi key is a compile-time error.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "hi";

const LANG_STORAGE_KEY = "daksync_lang";

/* ------------------------------------------------------------------ */
/* Dictionaries                                                        */
/* ------------------------------------------------------------------ */

const en = {
  common: {
    appName: "DAKSYNC",
    tagline: "India Post · SIH 2026",
    loading: "Loading…",
    error: "Something went wrong",
    retry: "Try again",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    confirm: "Confirm",
    back: "Back",
    copy: "Copy",
    copied: "Copied!",
    notAvailable: "Not available",
    none: "None",
    all: "All",
    search: "Search",
    filter: "Filter",
    optional: "optional",
    refresh: "Refresh",
    close: "Close",
    submit: "Submit",
  },
  languageName: {
    en: "English",
    hi: "हिन्दी",
  },
  nav: {
    home: "Home",
    login: "Login",
    logout: "Log out",
    track: "Track",
    dashboard: "Dashboard",
    newConsignment: "New consignment",
    signedInAs: "Signed in as",
  },
  roles: {
    ADMIN: "Administrator",
    SUPERVISOR: "Supervisor",
    POSTMAN: "Postman",
    SENDER: "Sender",
    RECIPIENT: "Recipient",
  },
  landing: {
    heroTitle: "Delivery, scheduled around you.",
    heroSubtitle:
      "AI-assisted delivery scheduling & route planning for India Post. Tell us when you are available — we plan the delivery around it.",
    backendConnection: "Backend connection",
    connected: "Connected",
    checking: "Checking…",
    notReachable: "Not reachable",
    service: "Service",
    version: "Version",
    database: "Database",
    status: "Status",
    backendHelp:
      "Could not reach the backend. Start it with uvicorn app.main:app --reload in backend/.",
    journeyTitle: "The DAKSYNC journey",
    entryTitle: "Where would you like to go?",
    supervisorCard: "Staff sign in",
    supervisorCardDesc:
      "Supervisors & administrators — open the control room dashboard.",
    senderCard: "Book a delivery",
    senderCardDesc: "Senders — create a new consignment and share a slot link.",
    trackCard: "Track a parcel",
    trackCardDesc:
      "Recipients — follow your parcel and choose a delivery time.",
    open: "Open",
  },
  pipeline: {
    step1: "Create consignment",
    step2: "AI recommends a slot",
    step3: "Recipient confirms / changes",
    step4: "Route optimized",
    step5: "Postman delivers + OTP",
    step6: "Delivery completed",
    step7: "Analytics update",
  },
  login: {
    title: "Sign in",
    subtitle: "",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    demoTitle: "Quick Access Accounts",
    demoHint: "Select an account to pre-fill credentials.",
    invalid: "Invalid email or password.",
    postmanNote:
      "Postmen use the DAKSYNC field app (Flutter) for on-road delivery. This web console is read-oriented for field staff.",
  },
  dashboard: {
    title: "Control room",
    subtitle: "Live view of today's deliveries and routes.",
    kpiTotalActive: "Active parcels",
    kpiDeliveredToday: "Delivered today",
    kpiOutForDelivery: "Out for delivery",
    kpiPendingSlot: "Awaiting slot",
    kpiFailedToday: "Failed today",
    kpiFirstAttempt: "First-attempt success",
    kpiRoutesPlanned: "Routes planned",
    kpiTotalDistance: "Total route distance",
    slotDistribution: "Slot distribution",
    slotDistributionEmpty: "No slots confirmed yet.",
    statusBreakdown: "Status breakdown",
    statusBreakdownEmpty: "No consignments yet.",
    consignments: "Consignments",
    searchPlaceholder: "Search tracking or recipient…",
    statusFilter: "Status",
    optimizeRoutes: "Optimize routes today",
    optimizing: "Optimizing…",
    routes: "Routes",
    noRoutes: "No routes planned yet. Run the optimizer to build today's runs.",
    noConsignments: "No consignments match your filters.",
    colTracking: "Tracking",
    colRecipient: "Recipient",
    colLocality: "Locality",
    colStatus: "Status",
    colSlot: "Confirmed slot",
    agent: "Agent",
    optimizer: "Optimizer",
    stops: "Stops",
    distance: "Distance",
    sequence: "#",
    eta: "ETA",
    unassignedTitle: "Unassigned consignments",
    unassignedDesc: "These could not be placed on a route today:",
    routesGenerated: "Optimizer finished.",
    viewDetail: "View",
    unnamedAgent: "Unassigned agent",
    unassignedAgent: "Unassigned agent",
    allStatuses: "All statuses",
    newConsignment: "New consignment",
    routeHash: "Route #",
    startsAt: "Starts at",
    viewStops: "View stops",
    hideStops: "Hide stops",
    slotWindow: "Slot window",
  },
  consignmentNew: {
    title: "Book a delivery",
    subtitle: "Create a consignment and share a slot link with the recipient.",
    senderSection: "Sender",
    senderName: "Sender name",
    recipientSection: "Recipient",
    recipientName: "Full name",
    recipientPhone: "Phone",
    preferredLanguage: "Preferred language",
    addressSection: "Delivery address",
    line1: "Address line 1",
    line2: "Address line 2",
    localityLabel: "Locality",
    cityLabel: "City",
    stateLabel: "State",
    pincode: "PIN code",
    parcelSection: "Parcel",
    description: "Description",
    weight: "Weight (grams)",
    priority: "Priority",
    requestedSlot: "Requested slot",
    noPreference: "No preference",
    create: "Create consignment",
    creating: "Creating…",
    successTitle: "Consignment created",
    successDesc: "Share the link below so the recipient can choose their slot.",
    trackingNumber: "Tracking number",
    shareLink: "Recipient slot link",
    openSlotPage: "Open slot page",
    createAnother: "Book another",
  },
  priority: {
    NORMAL: "Normal",
    HIGH: "High",
    URGENT: "Urgent",
  },
  track: {
    title: "Track your parcel",
    subtitle: "Enter your tracking number to see status and delivery time.",
    placeholder: "e.g. DA000000512IN",
    trackBtn: "Track",
    tracking: "Tracking…",
    notFound: "We couldn't find that tracking number.",
    timeline: "Progress",
    address: "Delivery address",
    currentStatus: "Current status",
    confirmedSlot: "Confirmed slot",
    chooseSlotCta: "Choose your delivery time",
    chooseSlotDesc: "This parcel is waiting for you to pick a slot.",
    recipient: "Recipient",
    priorityLabel: "Priority",
  },
  confirm: {
    title: "Choose your delivery time",
    subtitle: "Pick the window that suits you best.",
    forRecipient: "Delivery for",
    recommended: "Recommended for you",
    selectPrompt: "Tap a time window to select it.",
    confirmBtn: "Confirm this time",
    confirming: "Confirming…",
    notAvailableNote: "Not available for this parcel",
    successTitle: "Delivery time confirmed",
    successMsg: "Thank you. Your parcel will arrive in this window:",
    changeAgain: "Choose a different time",
    alreadyConfirmed: "A delivery time has already been confirmed for this parcel.",
    trackingLabel: "Tracking",
    noOptions: "No delivery times are available right now. Please try later.",
  },
  status: {
    BOOKED: "Booked",
    RECEIVED_AT_ORIGIN: "Dropped at Origin Post Office",
    COLLECTED: "Collected",
    SORTED: "Sorted",
    IN_TRANSIT: "In Transit (Clubbed Bag)",
    RECEIVED_AT_DESTINATION: "Arrived at Destination Hub",
    SLOT_PENDING: "Slot pending",
    SLOT_CONFIRMED: "Slot confirmed",
    OUT_FOR_DELIVERY: "Out for delivery",
    DELIVERED: "Delivered",
    DELIVERY_FAILED: "Delivery failed",
    RESCHEDULED: "Rescheduled",
    RETURNED: "Returned",
  },
  routeStatus: {
    PLANNED: "Planned",
    DISPATCHED: "Dispatched",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
  },
  stopStatus: {
    PENDING: "Pending",
    ARRIVED: "Arrived",
    COMPLETED: "Completed",
    FAILED: "Failed",
    SKIPPED: "Skipped",
  },
  detail: {
    title: "Consignment detail",
    overview: "Overview",
    slotHistory: "Slot history",
    requestedSlot: "Requested",
    recommendedSlot: "Recommended",
    confirmedSlot: "Confirmed",
    address: "Address",
    parcel: "Parcel",
    sender: "Sender",
    recipient: "Recipient",
    quickActions: "Update status",
    updateStatus: "Set status",
    updatePriority: "Set priority",
    apply: "Apply",
    applying: "Applying…",
    updated: "Consignment updated.",
    geocoded: "Geocoded",
    notGeocoded: "Not geocoded",
    coordinates: "Coordinates",
    createdAt: "Created",
    weight: "Weight",
    grams: "g",
    notSet: "Not set",
    postOffice: "Post office",
  },
  guard: {
    notAuthorizedTitle: "Not authorized",
    notAuthorizedDesc:
      "Your account role does not have access to this page. Contact an administrator if you believe this is a mistake.",
    goHome: "Go to home",
    redirecting: "Redirecting to sign in…",
  },
  map: {
    viewModeList: "List view",
    viewModeMap: "Map view",
    viewOnMap: "View on map",
    routeMapTitle: "Interactive Route Map",
    filterRoute: "Filter route",
    allRoutes: "All routes",
    depot: "Post Office Depot",
    stop: "Stop",
    eta: "ETA",
    openNavigation: "Open in Maps / GPS",
    clickToPick: "Click or drag pin to select delivery point",
    quickPresets: "Nashik locality presets",
    coordinates: "Coordinates",
    reverseGeocoding: "Looking up address…",
    addressFilled: "Address updated from map pin",
    unassignedParcels: "Unassigned parcels",
    selectedStop: "Selected stop",
    destination: "Destination",
    distanceFromDepot: "Distance from depot",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    resetView: "Reset view",
  },
};

const hi: typeof en = {
  common: {
    appName: "DAKSYNC",
    tagline: "भारतीय डाक · SIH 2026",
    loading: "लोड हो रहा है…",
    error: "कुछ गड़बड़ हो गई",
    retry: "फिर से प्रयास करें",
    save: "सहेजें",
    saving: "सहेजा जा रहा है…",
    cancel: "रद्द करें",
    confirm: "पुष्टि करें",
    back: "वापस",
    copy: "कॉपी करें",
    copied: "कॉपी हो गया!",
    notAvailable: "उपलब्ध नहीं",
    none: "कोई नहीं",
    all: "सभी",
    search: "खोजें",
    filter: "फ़िल्टर",
    optional: "वैकल्पिक",
    refresh: "ताज़ा करें",
    close: "बंद करें",
    submit: "जमा करें",
  },
  languageName: {
    en: "English",
    hi: "हिन्दी",
  },
  nav: {
    home: "होम",
    login: "लॉगिन",
    logout: "लॉग आउट",
    track: "ट्रैक करें",
    dashboard: "डैशबोर्ड",
    newConsignment: "नई खेप",
    signedInAs: "साइन इन",
  },
  roles: {
    ADMIN: "प्रशासक",
    SUPERVISOR: "पर्यवेक्षक",
    POSTMAN: "डाकिया",
    SENDER: "प्रेषक",
    RECIPIENT: "प्राप्तकर्ता",
  },
  landing: {
    heroTitle: "डिलीवरी, आपके समय के अनुसार।",
    heroSubtitle:
      "भारतीय डाक के लिए AI-सहायता प्राप्त डिलीवरी शेड्यूलिंग और रूट योजना। हमें बताएं कि आप कब उपलब्ध हैं — हम उसी के अनुसार डिलीवरी की योजना बनाते हैं।",
    backendConnection: "बैकएंड कनेक्शन",
    connected: "जुड़ा हुआ",
    checking: "जाँच हो रही है…",
    notReachable: "पहुँच नहीं",
    service: "सेवा",
    version: "संस्करण",
    database: "डेटाबेस",
    status: "स्थिति",
    backendHelp:
      "बैकएंड तक नहीं पहुँच सका। इसे backend/ में uvicorn app.main:app --reload से शुरू करें।",
    journeyTitle: "DAKSYNC यात्रा",
    entryTitle: "आप कहाँ जाना चाहेंगे?",
    supervisorCard: "स्टाफ साइन इन",
    supervisorCardDesc:
      "पर्यवेक्षक और प्रशासक — कंट्रोल रूम डैशबोर्ड खोलें।",
    senderCard: "डिलीवरी बुक करें",
    senderCardDesc: "प्रेषक — नई खेप बनाएं और स्लॉट लिंक साझा करें।",
    trackCard: "पार्सल ट्रैक करें",
    trackCardDesc:
      "प्राप्तकर्ता — अपने पार्सल को ट्रैक करें और डिलीवरी समय चुनें।",
    open: "खोलें",
  },
  pipeline: {
    step1: "खेप बनाएं",
    step2: "AI स्लॉट सुझाता है",
    step3: "प्राप्तकर्ता पुष्टि / बदलाव करता है",
    step4: "रूट अनुकूलित",
    step5: "डाकिया डिलीवरी + OTP",
    step6: "डिलीवरी पूर्ण",
    step7: "एनालिटिक्स अपडेट",
  },
  login: {
    title: "साइन इन करें",
    subtitle: "",
    email: "ईमेल",
    password: "पासवर्ड",
    signIn: "साइन इन करें",
    signingIn: "साइन इन हो रहा है…",
    demoTitle: "त्वरित प्रवेश खाते",
    demoHint: "क्रेडेंशियल भरने के लिए खाता चुनें।",
    invalid: "अमान्य ईमेल या पासवर्ड।",
    postmanNote:
      "डाकिया सड़क पर डिलीवरी के लिए DAKSYNC फील्ड ऐप (Flutter) का उपयोग करते हैं। यह वेब कंसोल फील्ड स्टाफ के लिए मुख्य रूप से पढ़ने हेतु है।",
  },
  dashboard: {
    title: "कंट्रोल रूम",
    subtitle: "आज की डिलीवरी और रूट का लाइव दृश्य।",
    kpiTotalActive: "सक्रिय पार्सल",
    kpiDeliveredToday: "आज वितरित",
    kpiOutForDelivery: "डिलीवरी के लिए निकले",
    kpiPendingSlot: "स्लॉट प्रतीक्षित",
    kpiFailedToday: "आज विफल",
    kpiFirstAttempt: "पहले प्रयास में सफलता",
    kpiRoutesPlanned: "नियोजित रूट",
    kpiTotalDistance: "कुल रूट दूरी",
    slotDistribution: "स्लॉट वितरण",
    slotDistributionEmpty: "अभी तक कोई स्लॉट पुष्ट नहीं।",
    statusBreakdown: "स्थिति विवरण",
    statusBreakdownEmpty: "अभी तक कोई खेप नहीं।",
    consignments: "खेप",
    searchPlaceholder: "ट्रैकिंग या प्राप्तकर्ता खोजें…",
    statusFilter: "स्थिति",
    optimizeRoutes: "आज के रूट अनुकूलित करें",
    optimizing: "अनुकूलित हो रहा है…",
    routes: "रूट",
    noRoutes:
      "अभी तक कोई रूट नियोजित नहीं। आज के रन बनाने के लिए ऑप्टिमाइज़र चलाएं।",
    noConsignments: "आपके फ़िल्टर से मेल खाती कोई खेप नहीं।",
    colTracking: "ट्रैकिंग",
    colRecipient: "प्राप्तकर्ता",
    colLocality: "क्षेत्र",
    colStatus: "स्थिति",
    colSlot: "पुष्ट स्लॉट",
    agent: "एजेंट",
    optimizer: "ऑप्टिमाइज़र",
    stops: "स्टॉप",
    distance: "दूरी",
    sequence: "#",
    eta: "अनुमानित समय",
    unassignedTitle: "बिना असाइन की गई खेप",
    unassignedDesc: "इन्हें आज किसी रूट पर नहीं रखा जा सका:",
    routesGenerated: "ऑप्टिमाइज़र पूरा हुआ।",
    viewDetail: "देखें",
    unnamedAgent: "बिना एजेंट",
    unassignedAgent: "अनिर्धारित डाकिया",
    allStatuses: "सभी स्थितियाँ",
    newConsignment: "नया पार्सल",
    routeHash: "रूट #",
    startsAt: "प्रारंभ समय",
    viewStops: "स्टॉप देखें",
    hideStops: "स्टॉप छुपाएं",
    slotWindow: "स्लॉट विंडो",
  },
  consignmentNew: {
    title: "डिलीवरी बुक करें",
    subtitle: "खेप बनाएं और प्राप्तकर्ता के साथ स्लॉट लिंक साझा करें।",
    senderSection: "प्रेषक",
    senderName: "प्रेषक का नाम",
    recipientSection: "प्राप्तकर्ता",
    recipientName: "पूरा नाम",
    recipientPhone: "फ़ोन",
    preferredLanguage: "पसंदीदा भाषा",
    addressSection: "डिलीवरी पता",
    line1: "पता पंक्ति 1",
    line2: "पता पंक्ति 2",
    localityLabel: "क्षेत्र",
    cityLabel: "शहर",
    stateLabel: "राज्य",
    pincode: "पिन कोड",
    parcelSection: "पार्सल",
    description: "विवरण",
    weight: "वज़न (ग्राम)",
    priority: "प्राथमिकता",
    requestedSlot: "अनुरोधित स्लॉट",
    noPreference: "कोई प्राथमिकता नहीं",
    create: "खेप बनाएं",
    creating: "बनाया जा रहा है…",
    successTitle: "खेप बन गई",
    successDesc: "नीचे दिया गया लिंक साझा करें ताकि प्राप्तकर्ता अपना स्लॉट चुन सके।",
    trackingNumber: "ट्रैकिंग नंबर",
    shareLink: "प्राप्तकर्ता स्लॉट लिंक",
    openSlotPage: "स्लॉट पेज खोलें",
    createAnother: "एक और बुक करें",
  },
  priority: {
    NORMAL: "सामान्य",
    HIGH: "उच्च",
    URGENT: "अत्यावश्यक",
  },
  track: {
    title: "अपना पार्सल ट्रैक करें",
    subtitle: "स्थिति और डिलीवरी समय देखने के लिए अपना ट्रैकिंग नंबर दर्ज करें।",
    placeholder: "उदा. DA000000512IN",
    trackBtn: "ट्रैक करें",
    tracking: "ट्रैक हो रहा है…",
    notFound: "हमें वह ट्रैकिंग नंबर नहीं मिला।",
    timeline: "प्रगति",
    address: "डिलीवरी पता",
    currentStatus: "वर्तमान स्थिति",
    confirmedSlot: "पुष्ट स्लॉट",
    chooseSlotCta: "अपना डिलीवरी समय चुनें",
    chooseSlotDesc: "यह पार्सल आपके स्लॉट चुनने की प्रतीक्षा में है।",
    recipient: "प्राप्तकर्ता",
    priorityLabel: "प्राथमिकता",
  },
  confirm: {
    title: "अपना डिलीवरी समय चुनें",
    subtitle: "वह समय चुनें जो आपके लिए सबसे उपयुक्त हो।",
    forRecipient: "डिलीवरी हेतु",
    recommended: "आपके लिए सुझाव",
    selectPrompt: "चुनने के लिए किसी समय-अवधि पर टैप करें।",
    confirmBtn: "यह समय पुष्ट करें",
    confirming: "पुष्टि हो रही है…",
    notAvailableNote: "इस पार्सल के लिए उपलब्ध नहीं",
    successTitle: "डिलीवरी समय पुष्ट",
    successMsg: "धन्यवाद। आपका पार्सल इस अवधि में पहुँचेगा:",
    changeAgain: "अलग समय चुनें",
    alreadyConfirmed: "इस पार्सल के लिए डिलीवरी समय पहले ही पुष्ट किया जा चुका है।",
    trackingLabel: "ट्रैकिंग",
    noOptions: "अभी कोई डिलीवरी समय उपलब्ध नहीं है। कृपया बाद में प्रयास करें।",
  },
  status: {
    BOOKED: "बुक किया गया",
    RECEIVED_AT_ORIGIN: "मूल डाकघर में जमा",
    COLLECTED: "संग्रहित",
    SORTED: "छाँटा गया",
    IN_TRANSIT: "ट्रांजिट में (क्लब बैग)",
    RECEIVED_AT_DESTINATION: "गंतव्य केंद्र पर पहुँचा",
    SLOT_PENDING: "स्लॉट प्रतीक्षित",
    SLOT_CONFIRMED: "स्लॉट पुष्ट",
    OUT_FOR_DELIVERY: "डिलीवरी के लिए निकला",
    DELIVERED: "वितरित",
    DELIVERY_FAILED: "डिलीवरी विफल",
    RESCHEDULED: "पुनर्निर्धारित",
    RETURNED: "लौटाया गया",
  },
  routeStatus: {
    PLANNED: "नियोजित",
    DISPATCHED: "रवाना",
    IN_PROGRESS: "प्रगति में",
    COMPLETED: "पूर्ण",
  },
  stopStatus: {
    PENDING: "लंबित",
    ARRIVED: "पहुँचा",
    COMPLETED: "पूर्ण",
    FAILED: "विफल",
    SKIPPED: "छोड़ा गया",
  },
  detail: {
    title: "खेप विवरण",
    overview: "सारांश",
    slotHistory: "स्लॉट इतिहास",
    requestedSlot: "अनुरोधित",
    recommendedSlot: "सुझाया गया",
    confirmedSlot: "पुष्ट",
    address: "पता",
    parcel: "पार्सल",
    sender: "प्रेषक",
    recipient: "प्राप्तकर्ता",
    quickActions: "स्थिति अपडेट करें",
    updateStatus: "स्थिति सेट करें",
    updatePriority: "प्राथमिकता सेट करें",
    apply: "लागू करें",
    applying: "लागू हो रहा है…",
    updated: "खेप अपडेट हो गई।",
    geocoded: "जियोकोडेड",
    notGeocoded: "जियोकोड नहीं",
    coordinates: "निर्देशांक",
    createdAt: "बनाया गया",
    weight: "वज़न",
    grams: "ग्राम",
    notSet: "सेट नहीं",
    postOffice: "डाकघर",
  },
  guard: {
    notAuthorizedTitle: "अधिकृत नहीं",
    notAuthorizedDesc:
      "आपके खाते की भूमिका को इस पेज तक पहुँच नहीं है। यदि आपको लगता है कि यह त्रुटि है तो प्रशासक से संपर्क करें।",
    goHome: "होम पर जाएं",
    redirecting: "साइन इन पर पुनर्निर्देशित हो रहा है…",
  },
  map: {
    viewModeList: "सूची दृश्य",
    viewModeMap: "मानचित्र दृश्य",
    viewOnMap: "मानचित्र पर देखें",
    routeMapTitle: "इंटरैक्टिव रूट मैप",
    filterRoute: "रूट फ़िल्टर",
    allRoutes: "सभी रूट",
    depot: "डाकघर डिपो",
    stop: "स्टॉप",
    eta: "अनुमानित समय",
    openNavigation: "मानचित्र / जीपीएस में खोलें",
    clickToPick: "डिलीवरी स्थान चुनने के लिए मानचित्र पर क्लिक या पिन खींचें",
    quickPresets: "नासिक क्षेत्र प्रीसेट",
    coordinates: "निर्देशांक",
    reverseGeocoding: "पता खोजा जा रहा है…",
    addressFilled: "मानचित्र पिन से पता अपडेट किया गया",
    unassignedParcels: "बिना असाइन किए गए पार्सल",
    selectedStop: "चयनित स्टॉप",
    destination: "गंतव्य",
    distanceFromDepot: "डिपो से दूरी",
    zoomIn: "बड़ा करें",
    zoomOut: "छोटा करें",
    resetView: "रीसेट करें",
  },
};

const dictionaries: Record<Lang, typeof en> = { en, hi };

/* ------------------------------------------------------------------ */
/* Lookup                                                              */
/* ------------------------------------------------------------------ */

type DictNode = string | { [key: string]: DictNode };

function lookup(root: DictNode, segments: string[]): string | undefined {
  let node: DictNode | undefined = root;
  for (const seg of segments) {
    if (node && typeof node === "object" && seg in node) {
      node = node[seg];
    } else {
      return undefined;
    }
  }
  return typeof node === "string" ? node : undefined;
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Hydrate the saved preference after mount (avoids SSR mismatch).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === "en" || saved === "hi") setLangState(saved);
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  // Keep <html lang> in step for accessibility.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string): string => {
      const segments = key.split(".");
      return (
        lookup(dictionaries[lang] as DictNode, segments) ??
        lookup(dictionaries.en as DictNode, segments) ??
        key
      );
    },
    [lang],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, t }),
    [lang, setLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}

/**
 * Pick the correct bilingual field from an API object that ships both an
 * `_en` and `_hi` variant. Falls back to whichever is present.
 */
export function pickLang(
  lang: Lang,
  en: string | null | undefined,
  hi: string | null | undefined,
): string {
  const primary = lang === "hi" ? hi : en;
  return primary ?? en ?? hi ?? "";
}

/* ------------------------------------------------------------------ */
/* Language toggle                                                     */
/* ------------------------------------------------------------------ */

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  const options: { value: Lang; label: string }[] = [
    { value: "en", label: "EN" },
    { value: "hi", label: "हिन्दी" },
  ];
  return (
    <div
      className={`inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5 ${className}`}
      role="group"
      aria-label="Language"
    >
      {options.map((opt) => {
        const active = lang === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLang(opt.value)}
            aria-pressed={active}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              active
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:text-brand-700"
            } ${opt.value === "hi" ? "font-hindi" : ""}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
