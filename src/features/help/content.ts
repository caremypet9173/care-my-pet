import type { Locale } from "@/i18n/types";

export interface HelpShot {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
  dark?: boolean;
  wide?: boolean;
}

export interface HelpStep {
  id?: string;
  number: string;
  title: string;
  body: string;
  bullets?: string[];
  tip?: string;
  shots?: HelpShot[];
}

export interface HelpGuideSummary {
  slug: "notifications" | "medical-reports" | "sharing-and-recovery";
  href: string;
  readTime: string;
  title: string;
  description: string;
  highlights: string[];
  cta: string;
}

export interface HelpIndexContent {
  eyebrow: string;
  title: string;
  intro: string;
  guides: HelpGuideSummary[];
  shortcutsTitle: string;
  shortcuts: { href: string; label: string }[];
}

export interface HelpFaqItem {
  question: string;
  answer: string;
}

export interface NotificationsGuideContent {
  metaTitle: string;
  metaDescription: string;
  breadcrumb: string;
  eyebrow: string;
  title: string;
  intro: string;
  readTime: string;
  updatedLabel: string;
  tabs: {
    android: string;
    ios: string;
    desktop: string;
  };
  android: {
    jumpLabel: string;
    jumps: { href: string; label: string }[];
    installSection: {
      eyebrow: string;
      title: string;
      intro: string;
      steps: HelpStep[];
    };
    unblockSection: {
      eyebrow: string;
      title: string;
      intro: string;
      calloutTitle: string;
      calloutBody: string;
      steps: HelpStep[];
    };
    batterySection: {
      eyebrow: string;
      title: string;
      intro: string;
      calloutTitle: string;
      calloutBody: string;
      steps: HelpStep[];
      vendorTitle: string;
      vendorHeaders: [string, string, string];
      vendorRows: [string, string, string][];
    };
  };
  ios: {
    calloutTitle: string;
    calloutBody: string;
    steps: HelpStep[];
    unblockTitle: string;
    unblockBody: string;
  };
  desktop: {
    calloutTitle: string;
    calloutBody: string;
    cards: { title: string; body: string }[];
  };
  faqTitle: string;
  faq: HelpFaqItem[];
}

export interface MedicalReportsGuideContent {
  metaTitle: string;
  metaDescription: string;
  breadcrumb: string;
  eyebrow: string;
  title: string;
  intro: string;
  readTime: string;
  calloutTitle: string;
  calloutBody: string;
  steps: HelpStep[];
  tipsTitle: string;
  tips: { title: string; body: string }[];
  faqTitle: string;
  faq: HelpFaqItem[];
}

export interface SharingRecoveryGuideContent {
  metaTitle: string;
  metaDescription: string;
  breadcrumb: string;
  eyebrow: string;
  title: string;
  intro: string;
  readTime: string;
  vetSection: {
    eyebrow: string;
    title: string;
    intro: string;
    steps: HelpStep[];
  };
  recoverySection: {
    eyebrow: string;
    title: string;
    intro: string;
    calloutTitle: string;
    calloutBody: string;
    steps: HelpStep[];
  };
  faqTitle: string;
  faq: HelpFaqItem[];
}

export const helpCommonMessages: Record<
  Locale,
  {
    home: string;
    helpCenter: string;
    backToHelp: string;
    nextGuide: string;
    prevGuide: string;
    screenshotNote?: string;
  }
> = {
  pl: {
    home: "Strona główna",
    helpCenter: "Centrum pomocy",
    backToHelp: "Wszystkie poradniki",
    nextGuide: "Kolejny poradnik",
    prevGuide: "Poprzedni poradnik",
  },
  en: {
    home: "Home",
    helpCenter: "Help center",
    backToHelp: "All guides",
    nextGuide: "Next guide",
    prevGuide: "Previous guide",
    screenshotNote:
      "Note: System and app screenshots currently show the Polish interface labels; exact English menu names are given in the text next to each step.",
  },
};

export const helpIndexContent: Record<Locale, HelpIndexContent> = {
  pl: {
    eyebrow: "Centrum pomocy",
    title: "Poradniki krok po kroku",
    intro:
      "Krótkie instrukcje z ekranami dla opiekunów korzystających z Care My Pet — bez żargonu, dokładnie tak jak wyglądają na telefonie i komputerze.",
    guides: [
      {
        slug: "notifications",
        href: "/help/notifications",
        readTime: "3 min",
        title: "Powiadomienia Push i instalacja aplikacji",
        description:
          "Jak zainstalować Care My Pet na telefonie, włączyć alerty o lekach i wizytach oraz odblokować powiadomienia na Androidzie i iPhonie.",
        highlights: [
          "Instalacja aplikacji PWA z Chrome na ekran główny",
          "Odblokowanie powiadomień „Zarządzanych przez aplikację” na Androidzie",
          "Wyłączenie usypiania aplikacji i ograniczeń baterii",
        ],
        cta: "Otwórz instrukcję",
      },
      {
        slug: "medical-reports",
        href: "/help/medical-reports",
        readTime: "2 min",
        title: "Skanowanie i zatwierdzanie wyników badań",
        description:
          "Jak dodać PDF lub zdjęcie z laboratorium, uruchomić odczyt Gemini i sprawdzić wartości obok oryginału przed zapisaniem.",
        highlights: [
          "Obsługa PDF, JPG i PNG do 12 MB (maks. 10 stron)",
          "Widok Split-Screen: oryginał obok odczytanych parametrów",
          "Pełna kontrola — nic nie zapisuje się bez Twojego zatwierdzenia",
        ],
        cta: "Otwórz instrukcję",
      },
      {
        slug: "sharing-and-recovery",
        href: "/help/sharing-and-recovery",
        readTime: "2 min",
        title: "Udostępnianie weterynarzowi i Klucz Odzyskiwania",
        description:
          "Jak pokazać lekarzowi kartotekę jednym kodem QR bez zakładania konta oraz jak bezpiecznie zapisać jednorazowy Klucz Odzyskiwania.",
        highlights: [
          "Tymczasowy link lub QR (1 h / 24 h / 7 dni) tylko do odczytu",
          "Wspólna opieka z domownikami w jednym gospodarstwie",
          "Karta PDF z Kluczem Odzyskiwania na wypadek utraty konta",
        ],
        cta: "Otwórz instrukcję",
      },
    ],
    shortcutsTitle: "Najczęstsze problemy — przejdź od razu do rozwiązania",
    shortcuts: [
      {
        href: "/help/notifications#android-unblock",
        label: "Android blokuje powiadomienia / „Zarządzane przez aplikację”",
      },
      {
        href: "/help/notifications#android-battery",
        label: "Powiadomienia przestały przychodzić po kilku dniach (Android)",
      },
      {
        href: "/help/notifications#ios",
        label: "Nie mogę włączyć Push na iPhonie (Safari)",
      },
      {
        href: "/help/sharing-and-recovery#recovery-key",
        label: "Dlaczego muszę wygenerować Klucz Odzyskiwania?",
      },
    ],
  },
  en: {
    eyebrow: "Help center",
    title: "Step-by-step guides",
    intro:
      "Short illustrated guides for pet owners using Care My Pet — straight to the point, matching the actual screens on mobile and desktop.",
    guides: [
      {
        slug: "notifications",
        href: "/help/notifications",
        readTime: "3 min",
        title: "Push notifications & app installation",
        description:
          "How to install Care My Pet on your phone, enable medication and visit alerts, and fix blocked or paused notifications on Android and iPhone.",
        highlights: [
          "Installing the PWA from Chrome onto your Home Screen",
          "Unblocking notifications “Managed by app” on Android",
          "Disabling app hibernation and battery throttling",
        ],
        cta: "Open guide",
      },
      {
        slug: "medical-reports",
        href: "/help/medical-reports",
        readTime: "2 min",
        title: "Scanning & reviewing lab results",
        description:
          "How to upload a clinic PDF or photo, run Gemini extraction, and verify every value side-by-side with the original document before saving.",
        highlights: [
          "PDF, JPG, and PNG up to 12 MB (max 10 pages)",
          "Split-Screen review: original scan next to extracted values",
          "Full control — nothing is saved without your confirmation",
        ],
        cta: "Open guide",
      },
      {
        slug: "sharing-and-recovery",
        href: "/help/sharing-and-recovery",
        readTime: "2 min",
        title: "Sharing with your vet & Recovery Key",
        description:
          "How to share a read-only record with your vet via QR code without requiring a vet account, and how to store your one-time Recovery Key safely.",
        highlights: [
          "Temporary read-only link or QR code (1h / 24h / 7 days)",
          "Shared family care within one household",
          "Printable PDF Recovery Key card in case of account loss",
        ],
        cta: "Open guide",
      },
    ],
    shortcutsTitle: "Quick fixes — jump directly to the answer",
    shortcuts: [
      {
        href: "/help/notifications#android-unblock",
        label: "Android blocks notifications / “Managed by app”",
      },
      {
        href: "/help/notifications#android-battery",
        label: "Notifications stopped arriving after a few days (Android)",
      },
      {
        href: "/help/notifications#ios",
        label: "Push notifications unavailable on iPhone (Safari)",
      },
      {
        href: "/help/sharing-and-recovery#recovery-key",
        label: "Why do I need to generate a Recovery Key?",
      },
    ],
  },
};

export const notificationsGuideContent: Record<
  Locale,
  NotificationsGuideContent
> = {
  pl: {
    metaTitle: "Powiadomienia Push i instalacja aplikacji — Pomoc",
    metaDescription:
      "Instrukcja krok po kroku: jak zainstalować Care My Pet jako aplikację (PWA), włączyć powiadomienia Push na Androidzie i iPhonie oraz zapobiec ich usypianiu.",
    breadcrumb: "Powiadomienia i PWA",
    eyebrow: "Poradnik 1 z 3",
    title: "Powiadomienia Push i instalacja aplikacji",
    intro:
      "Przypomnienia o dawkach leków, płynoterapii i wizytach mogą przychodzić prosto na ekran blokady telefonu. Poniżej znajdziesz dokładne kroki dla Androida, iPhone’a i komputera — także na wypadek, gdy telefon zablokował lub uśpił powiadomienia.",
    readTime: "Czas czytania: ~3 min",
    updatedLabel: "Sprawdzone na Androidzie (Chrome) i iOS (Safari)",
    tabs: {
      android: "Android (Chrome / PWA)",
      ios: "iPhone i iPad (Safari)",
      desktop: "Komputer i e-mail",
    },
    android: {
      jumpLabel: "Przejdź do sekcji:",
      jumps: [
        { href: "#android-install", label: "1. Instalacja i włączenie" },
        { href: "#android-unblock", label: "2. Gdy są zablokowane" },
        { href: "#android-battery", label: "3. Ochrona przed usypianiem" },
      ],
      installSection: {
        eyebrow: "Część 1",
        title: "Zainstaluj Care My Pet i włącz powiadomienia Push",
        intro:
          "Najwygodniej zainstalować Care My Pet na ekranie głównym (działa jak zwykła aplikacja i nie wymaga sklepu Google Play), a potem włączyć powiadomienia w Terminarzu.",
        steps: [
          {
            number: "1",
            title: "Dodaj Care My Pet do ekranu głównego",
            body: "Otwórz caremypet.pl w przeglądarce Google Chrome. Jeśli na dole ekranu pojawi się pasek „Zainstaluj Care My Pet”, kliknij Zainstaluj. Jeśli go nie widzisz, otwórz menu ⋮ (trzy kropki w prawym górnym rogu Chrome) i wybierz „Zainstaluj i utwórz skrót” (na starszych wersjach: „Dodaj do ekranu głównego”).",
            tip: "Po instalacji na pulpicie telefonu pojawi się zielona ikona Care My Pet — od tego momentu najlepiej otwierać aplikację właśnie z niej.",
            shots: [
              {
                src: "/media/guides/app-pwa-banner.webp",
                width: 780,
                height: 768,
                alt: "Dolny baner w Care My Pet z przyciskiem Zainstaluj",
                caption: "Szybki pasek instalacji na dole ekranu aplikacji",
              },
              {
                src: "/media/guides/android-chrome-menu.webp",
                width: 404,
                height: 892,
                alt: "Menu przeglądarki Chrome na Androidzie z podświetloną opcją Zainstaluj i utwórz skrót",
                caption: "Menu ⋮ w Chrome → Zainstaluj i utwórz skrót",
                dark: true,
              },
            ],
          },
          {
            number: "2",
            title: "Włącz powiadomienia Push w Terminarzu",
            body: "Otwórz Care My Pet, przejdź na Pulpit domowy i przewiń poniżej kart pupili do sekcji „Wspólny terminarz i przypomnienia domowe” (przycisk znajdziesz też w zakładce Terminarz wewnątrz kartoteki pupila). Kliknij przycisk z dzwonkiem „Powiadomienia”, a następnie „Włącz powiadomienia Push” i potwierdź zgodę w oknie systemu.",
            shots: [
              {
                src: "/media/guides/app-schedule-notifications-btn.webp",
                width: 780,
                height: 640,
                alt: "Sekcja Wspólny terminarz w Care My Pet z podświetlonym przyciskiem Powiadomienia",
                caption: "Przycisk „Powiadomienia” nad kalendarzem",
              },
              {
                src: "/media/guides/app-push-inactive.webp",
                width: 580,
                height: 592,
                alt: "Karta Powiadomienia Push z przyciskiem Włącz powiadomienia Push",
                caption: "Kliknij „Włącz powiadomienia Push”",
              },
            ],
          },
          {
            number: "3",
            title: "Zweryfikuj działanie testowym powiadomieniem",
            body: "Gdy status zmieni się na zielony „Aktywne na tym telefonie / urządzeniu”, tuż pod spodem pojawi się przycisk „Wyślij testowy Push”. Kliknij go i na chwilę zablokuj ekran (albo zminimalizuj aplikację) — w ciągu kilku sekund zobaczysz powiadomienie testowe Care My Pet.",
            shots: [
              {
                src: "/media/guides/app-push-active.webp",
                width: 580,
                height: 1006,
                alt: "Aktywne powiadomienia Push z przyciskiem Wyślij testowy Push",
                caption: "Aktywny status i przycisk „Wyślij testowy Push”",
              },
              {
                src: "/media/guides/android-test-push.webp",
                width: 444,
                height: 232,
                alt: "Dostarczone testowe powiadomienie Push z Care My Pet na belce Androida",
                caption: "Poprawnie dostarczony test na telefonie",
                dark: true,
              },
            ],
          },
        ],
      },
      unblockSection: {
        eyebrow: "Część 2 — Rozwiązywanie problemów",
        title: "Powiadomienia są zablokowane lub „Zarządzane przez aplikację”?",
        intro:
          "Jeśli widzisz czerwony komunikat „Zablokowane w ustawieniach aplikacji” albo przypadkiem kliknąłeś wcześniej „Nie zezwalaj”, samo klikanie w Care My Pet nie wystarczy — zgodę trzeba włączyć w ustawieniach Androida.",
        calloutTitle:
          "Dlaczego w Chrome nie mogę przełączyć powiadomień dla caremypet.pl?",
        calloutBody:
          "Po zainstalowaniu Care My Pet na ekranie głównym Chrome przenosi adres https://caremypet.pl do sekcji „Zarządzane przez aplikację”. Od tego momentu przełącznik powiadomień znajduje się w ustawieniach samej aplikacji Care My Pet w Androidzie (krok 1–3 poniżej), a nie w ustawieniach przeglądarki.",
        steps: [
          {
            number: "1",
            title: "Zobacz jak wygląda blokada (aplikacja i Chrome)",
            body: "W Care My Pet pojawia się status „Zablokowane w ustawieniach aplikacji”, a w ustawieniach Chrome (Powiadomienia) domena caremypet.pl widnieje w grupie „Zarządzane przez aplikację”. To znak, że zgodę należy przełączyć w ustawieniach ikony Care My Pet.",
            shots: [
              {
                src: "/media/guides/app-push-blocked.webp",
                width: 580,
                height: 858,
                alt: "Komunikat w Care My Pet o zablokowanych powiadomieniach w ustawieniach aplikacji",
                caption: "Status blokady w panelu Powiadomień",
              },
              {
                src: "/media/guides/android-chrome-managed.webp",
                width: 460,
                height: 312,
                alt: "Ustawienia powiadomień Chrome pokazujące sekcję Zarządzane przez aplikację z adresem caremypet.pl",
                caption: "Chrome przenosi zainstalowaną PWA do „Zarządzane przez aplikację”",
                dark: true,
              },
            ],
          },
          {
            number: "2",
            title: "Przytrzymaj ikonę Care My Pet i otwórz Informacje o aplikacji",
            body: "Wróć na ekran główny telefonu, przytrzymaj palcem ikonę Care My Pet przez około sekundę, a gdy pojawi się dymek, stuknij ikonę (i) w kółku (lub „Informacje o aplikacji”). Następnie na ekranie Informacje o aplikacji wybierz „Powiadomienia”.",
            shots: [
              {
                src: "/media/guides/android-icon-longpress.webp",
                width: 420,
                height: 310,
                alt: "Menu po przytrzymaniu ikony Care My Pet z podświetloną ikoną informacji i",
                caption: "Przytrzymaj ikonę → stuknij (i)",
                dark: true,
              },
              {
                src: "/media/guides/android-app-info.webp",
                width: 460,
                height: 696,
                alt: "Ekran Informacje o aplikacji dla Care My Pet z podświetloną opcją Powiadomienia",
                caption: "Wybierz „Powiadomienia”",
                dark: true,
              },
            ],
          },
          {
            number: "3",
            title: "Włącz przełącznik i wróć do Care My Pet",
            body: "Przesuń główny przełącznik „Wszystkie powiadomienia z aplikacji Care My Pet” w pozycję WŁĄCZONE. Następnie wróć do otwartej aplikacji Care My Pet — status w panelu Powiadomień odświeży się automatycznie, a Ty możesz kliknąć „Włącz powiadomienia Push” i „Wyślij testowy Push”.",
            shots: [
              {
                src: "/media/guides/android-app-notifications.webp",
                width: 460,
                height: 775,
                alt: "Włączony przełącznik Wszystkie powiadomienia z aplikacji Care My Pet w ustawieniach Androida",
                caption: "Włącz główny przełącznik powiadomień",
                dark: true,
              },
            ],
          },
        ],
      },
      batterySection: {
        eyebrow: "Część 3 — Niezawodność w tle",
        title: "Aby Android nie uśpił powiadomień przy rzadszych wizytach",
        intro:
          "Jeśli nie otwierasz aplikacji codziennie (np. czekasz na przypomnienie o szczepieniu za 2–3 miesiące), Android potrafi automatycznie odebrać uprawnienia nieużywanej aplikacji i zatrzymać jej powiadomienia. Dwie zmiany poniżej zabezpieczają przed tym na stałe.",
        calloutTitle: "Warto zrobić to od razu po włączeniu Push",
        calloutBody:
          "Care My Pet nie działa stale w tle i nie drenuje baterii — wyłączenie ograniczeń pozwala systemowi jedynie dostarczyć krótkie powiadomienie z serwera (Web Push) dokładnie o zaplanowanej porze.",
        steps: [
          {
            number: "1",
            title: "Wyłącz „Wstrzymaj aktywność w aplikacji, jeśli jest nieużywana”",
            body: "Na ekranie „Informacje o aplikacji” dla Care My Pet przewiń w dół do sekcji „Nieużywane ustawienia aplikacji” i wyłącz przełącznik „Wstrzymaj aktywność w aplikacji, jeśli jest nieużywana” (jak ostrzega sam Android w podpisie, włączona opcja potrafi usunąć uprawnienia oraz zatrzymać powiadomienia).",
            shots: [
              {
                src: "/media/guides/android-app-unused.webp",
                width: 460,
                height: 660,
                alt: "Wyłączony przełącznik Wstrzymaj aktywność w aplikacji jeśli jest nieużywana w ustawieniach Androida",
                caption: "Przełącznik w pozycji WYŁĄCZONE (szary)",
                dark: true,
              },
            ],
          },
          {
            number: "2",
            title: "Ustaw baterię na „Bez ograniczeń”",
            body: "W tych samych „Informacjach o aplikacji” wejdź w „Wykorzystanie baterii przez aplikacje” i wybierz opcję „Bez ograniczeń” (zamiast „Z optymalizacją” lub „Z ograniczeniami”). Dzięki temu system nie opóźni przypomnienia o podaniu leku.",
            shots: [
              {
                src: "/media/guides/android-app-battery.webp",
                width: 460,
                height: 776,
                alt: "Ekran Wykorzystanie baterii przez aplikacje z zaznaczoną opcją Bez ograniczeń",
                caption: "Zaznacz „Bez ograniczeń”",
                dark: true,
              },
            ],
          },
        ],
        vendorTitle: "Nazwy opcji na popularnych nakładkach Androida",
        vendorHeaders: [
          "Telefon / nakładka",
          "Wyłączenie usypiania aplikacji",
          "Ustawienie baterii",
        ],
        vendorRows: [
          [
            "Pixel / Motorola / czysty Android",
            "Informacje o aplikacji → Wstrzymaj aktywność w aplikacji, jeśli jest nieużywana → Wyłącz",
            "Wykorzystanie baterii przez aplikacje → Bez ograniczeń",
          ],
          [
            "Samsung (One UI)",
            "Informacje o aplikacji → Uprawnienia → Usuń uprawnienia, jeśli aplikacja jest nieużywana → Wyłącz",
            "Bateria → Nieograniczone",
          ],
          [
            "Xiaomi / Redmi / POCO (HyperOS / MIUI)",
            "Informacje o aplikacji → Wstrzymaj aktywność aplikacji, jeśli jest nieużywana → Wyłącz",
            "Oszczędzanie baterii → Brak ograniczeń",
          ],
        ],
      },
    },
    ios: {
      calloutTitle: "Wymóg systemu iOS: aplikacja musi być na ekranie początkowym",
      calloutBody:
        "Apple nie udostępnia powiadomień Web Push dla zwykłych kart otwartych w Safari ani w Chrome na iPhonie. Wystarczy jednak dodać Care My Pet do ekranu początkowego w Safari (zajmuje 10 sekund).",
      steps: [
        {
          number: "1",
          title: "Otwórz caremypet.pl w przeglądarce Safari",
          body: "Na iPhonie lub iPadzie użyj wbudowanej przeglądarki Safari (nie Chrome ani przeglądarki wewnątrz Messengera/WhatsAppa).",
        },
        {
          number: "2",
          title: "Stuknij przycisk Udostępnij → „Do ekranu początkowego”",
          body: "Na dolnym pasku Safari stuknij ikonę kwadratu ze strzałką w górę (Udostępnij), przewiń listę i wybierz „Do ekranu początkowego”, a następnie zatwierdź przyciskiem „Dodaj”.",
        },
        {
          number: "3",
          title: "Otwórz Care My Pet z nowej ikony na pulpicie",
          body: "Zamknij kartę Safari i uruchom Care My Pet z nowo utworzonej ikony na ekranie początkowym. Zaloguj się na swoje konto.",
        },
        {
          number: "4",
          title: "Włącz Push w Terminarzu i wyślij test",
          body: "Przejdź do sekcji Terminarz → „Powiadomienia” → „Włącz powiadomienia Push” → zezwól w oknie iOS. Następnie kliknij „Wyślij testowy Push” i zablokuj ekran telefonu.",
        },
      ],
      unblockTitle: "Powiadomienia zostały wcześniej zablokowane na iPhonie?",
      unblockBody:
        "Otwórz systemowe Ustawienia iOS → Powiadomienia → znajdź na liście Care My Pet → włącz „Zezwalaj na powiadomienia” (oraz styl alertu na ekranie blokady), a potem wróć do aplikacji.",
    },
    desktop: {
      calloutTitle: "Wskazówka: zostaw też włączone przypomnienia e-mail",
      calloutBody:
        "Dla codziennych leków najlepsze są powiadomienia Push na telefonie. Dla szczepień i wizyt kontrolnych odległych o kilka miesięcy warto zostawić włączone również przypomnienia e-mail (znajdziesz je bezpośrednio pod kartą Push w tym samym panelu).",
      cards: [
        {
          title: "Włączenie Push na komputerze (Chrome / Edge / Firefox / Safari)",
          body: "Otwórz Pulpit domowy → Terminarz → „Powiadomienia” → kliknij „Włącz powiadomienia Push” i zatwierdź prośbę przeglądarki. Status zmieni się na aktywny na tym urządzeniu.",
        },
        {
          title: "Odblokowanie w przeglądarce desktopowej",
          body: "Kliknij ikonę ustawień witryny (suwaki lub kłódka) po lewej stronie paska adresu caremypet.pl → Powiadomienia → wybierz „Zezwalaj” i odśwież stronę.",
        },
        {
          title: "Systemowe „Nie przeszkadzać” (Windows / macOS)",
          body: "Jeśli testowy Push nie pojawia się mimo zielonego statusu w aplikacji, sprawdź w ustawieniach Windows (Powiadomienia → Skupienie) lub macOS (Tryb skupienia), czy przeglądarka ma zezwolenie na banery.",
        },
        {
          title: "Przypomnienia e-mail i dodatkowi odbiorcy",
          body: "W tej samej sekcji „Powiadomienia” możesz włączyć codzienne poranne podsumowanie e-mail, a przy pojedynczej wizycie dopisać dodatkowy adres (np. partnera lub opiekuna na czas wyjazdu).",
        },
      ],
    },
    faqTitle: "Częste pytania o powiadomienia",
    faq: [
      {
        question: "Czy mogę włączyć powiadomienia na kilku urządzeniach jednocześnie?",
        answer:
          "Tak. Każde urządzenie (np. Twój telefon, telefon partnera z kontem współopiekuna oraz komputer w domu) rejestruje osobną subskrypcję Push. Wystarczy kliknąć „Włącz powiadomienia Push” na każdym z nich.",
      },
      {
        question: "Nie widzę przycisku „Wyślij testowy Push” — gdzie go szukać?",
        answer:
          "Przycisk pojawia się dopiero wtedy, gdy powiadomienia są aktywne na bieżącym urządzeniu (zielona etykieta „Aktywne na tym telefonie / urządzeniu”). Najpierw kliknij „Włącz powiadomienia Push” w sekcji Terminarz → Powiadomienia.",
      },
      {
        question: "Przeinstalowałem aplikację albo wyczyściłem dane Chrome i przestało działać",
        answer:
          "Wyczyszczenie danych witryny kasuje starą subskrypcję przeglądarki. Wejdź w Terminarz → Powiadomienia i kliknij ponownie „Włącz powiadomienia Push” — aplikacja automatycznie odświeży token i wyczyści nieaktualne zapisy.",
      },
      {
        question: "Czy wyłączenie ograniczeń baterii rozładuje mi telefon?",
        answer:
          "Nie. Care My Pet jest lekką aplikacją webową (PWA) i nie uruchamia własnych procesów w tle — korzysta wyłącznie ze standardowej usługi doręczania powiadomień Androida (FCM), więc zużycie baterii wynosi praktycznie 0%.",
      },
    ],
  },
  en: {
    metaTitle: "Push notifications & app installation — Help",
    metaDescription:
      "Step-by-step guide: install Care My Pet as a PWA, enable Push alerts on Android and iPhone, unblock app permissions, and prevent Android battery sleep.",
    breadcrumb: "Notifications & PWA",
    eyebrow: "Guide 1 of 3",
    title: "Push notifications & app installation",
    intro:
      "Medication doses, fluid therapy schedules, and vet reminders can arrive directly on your phone’s lock screen. Follow the steps below for Android, iPhone, or desktop — including fixes if notifications were blocked or paused.",
    readTime: "Read time: ~3 min",
    updatedLabel: "Verified on Android (Chrome) and iOS (Safari)",
    tabs: {
      android: "Android (Chrome / PWA)",
      ios: "iPhone & iPad (Safari)",
      desktop: "Desktop & email",
    },
    android: {
      jumpLabel: "Jump to section:",
      jumps: [
        { href: "#android-install", label: "1. Install & enable" },
        { href: "#android-unblock", label: "2. If blocked" },
        { href: "#android-battery", label: "3. Prevent sleep" },
      ],
      installSection: {
        eyebrow: "Part 1",
        title: "Install Care My Pet and enable Push notifications",
        intro:
          "For the best experience, install Care My Pet to your Home Screen (it behaves like a native app with no Play Store download needed), then activate Push in Schedule.",
        steps: [
          {
            number: "1",
            title: "Add Care My Pet to your Home Screen",
            body: "Open caremypet.pl in Google Chrome. If the bottom “Install Care My Pet” banner appears, tap Install. Otherwise open Chrome’s ⋮ menu in the top-right corner and tap “Install app” / “Add to Home screen”.",
            tip: "Once installed, open Care My Pet from its green Home Screen icon so Android tracks permissions consistently.",
            shots: [
              {
                src: "/media/guides/app-pwa-banner.webp",
                width: 780,
                height: 768,
                alt: "Care My Pet bottom install banner with Install button",
                caption: "In-app quick install banner",
              },
              {
                src: "/media/guides/android-chrome-menu.webp",
                width: 404,
                height: 892,
                alt: "Android Chrome menu with Install / Add to Home Screen highlighted",
                caption: "Chrome ⋮ menu → Install / Add to Home screen",
                dark: true,
              },
            ],
          },
          {
            number: "2",
            title: "Enable Push notifications in Schedule",
            body: "On your Dashboard, scroll below your pet cards to the shared schedule section (or open a pet’s Schedule tab). Tap “Notifications” (bell icon), then tap “Enable Push notifications” and approve Android’s permission prompt.",
            shots: [
              {
                src: "/media/guides/app-schedule-notifications-btn.webp",
                width: 780,
                height: 640,
                alt: "Shared schedule header highlighting the Notifications bell button",
                caption: "Tap “Notifications” above the calendar",
              },
              {
                src: "/media/guides/app-push-inactive.webp",
                width: 580,
                height: 592,
                alt: "Push notifications card with Enable Push notifications button",
                caption: "Tap “Enable Push notifications”",
              },
            ],
          },
          {
            number: "3",
            title: "Verify delivery with a test notification",
            body: "Once the badge turns green (“Active on this device”), the “Send test Push” button appears right below. Tap it and lock your screen (or switch away) — a Care My Pet test notification should appear within seconds.",
            shots: [
              {
                src: "/media/guides/app-push-active.webp",
                width: 580,
                height: 1006,
                alt: "Active Push status showing the Send test Push button",
                caption: "Active status with “Send test Push”",
              },
              {
                src: "/media/guides/android-test-push.webp",
                width: 444,
                height: 232,
                alt: "Delivered Care My Pet test Push notification on Android",
                caption: "Test notification delivered on Android",
                dark: true,
              },
            ],
          },
        ],
      },
      unblockSection: {
        eyebrow: "Part 2 — Troubleshooting",
        title: "Notifications blocked or “Managed by app”?",
        intro:
          "If Care My Pet shows a red “Blocked in app settings” status (or you tapped “Don’t allow” earlier), re-enabling requires toggling permission in Android’s App info.",
        calloutTitle:
          "Why can’t I toggle caremypet.pl notifications inside Chrome?",
        calloutBody:
          "Once you install Care My Pet as an app (PWA), Chrome moves https://caremypet.pl under “Managed by app”. From then on, notification permission is controlled in Android’s App info for Care My Pet (steps 1–3 below), not inside Chrome.",
        steps: [
          {
            number: "1",
            title: "Recognize the “Managed by app” state",
            body: "In Care My Pet you will see “Blocked in app settings”, and in Chrome’s Notifications list caremypet.pl sits under “Managed by app”. Switch permission directly on the installed Care My Pet icon.",
            shots: [
              {
                src: "/media/guides/app-push-blocked.webp",
                width: 580,
                height: 858,
                alt: "Blocked push status banner inside Care My Pet",
                caption: "Blocked status inside Care My Pet",
              },
              {
                src: "/media/guides/android-chrome-managed.webp",
                width: 460,
                height: 312,
                alt: "Chrome notifications screen showing caremypet.pl under Managed by app",
                caption: "Chrome lists installed PWAs under “Managed by app”",
                dark: true,
              },
            ],
          },
          {
            number: "2",
            title: "Long-press the Care My Pet icon → App info → Notifications",
            body: "Go to your Android Home Screen, press and hold the Care My Pet icon for 1 second, and tap the circled (i) icon (“App info”). On the App info screen, tap “Notifications”.",
            shots: [
              {
                src: "/media/guides/android-icon-longpress.webp",
                width: 420,
                height: 310,
                alt: "Long-press popup on Care My Pet icon highlighting the App info i button",
                caption: "Long-press icon → tap (i)",
                dark: true,
              },
              {
                src: "/media/guides/android-app-info.webp",
                width: 460,
                height: 696,
                alt: "Android App info screen for Care My Pet highlighting Notifications",
                caption: "Tap “Notifications”",
                dark: true,
              },
            ],
          },
          {
            number: "3",
            title: "Turn notifications ON and return to Care My Pet",
            body: "Switch on “All Care My Pet notifications”, then return to the Care My Pet app. The status refreshes automatically — tap “Enable Push notifications” and “Send test Push” to confirm.",
            shots: [
              {
                src: "/media/guides/android-app-notifications.webp",
                width: 460,
                height: 775,
                alt: "Android notification toggle enabled for Care My Pet",
                caption: "Turn on the master notification toggle",
                dark: true,
              },
            ],
          },
        ],
      },
      batterySection: {
        eyebrow: "Part 3 — Long-term reliability",
        title: "Prevent Android from pausing notifications between visits",
        intro:
          "If you only open the app occasionally (e.g. waiting for a vaccination reminder months away), Android can revoke permissions for unused apps and halt notifications. Two quick toggles prevent that permanently.",
        calloutTitle: "Recommended right after enabling Push",
        calloutBody:
          "Care My Pet does not run heavy background loops — lifting battery throttling simply lets Android deliver brief server Push alerts on time.",
        steps: [
          {
            number: "1",
            title: "Disable “Pause app activity if unused”",
            body: "In Care My Pet’s App info, scroll to “Unused app settings” and turn OFF “Pause app activity if unused” (as Android notes underneath, leaving it enabled removes permissions and stops notifications).",
            shots: [
              {
                src: "/media/guides/android-app-unused.webp",
                width: 460,
                height: 660,
                alt: "Android toggle Pause app activity if unused switched OFF",
                caption: "Switch OFF (grey)",
                dark: true,
              },
            ],
          },
          {
            number: "2",
            title: "Set App battery usage to “Unrestricted”",
            body: "Still in App info, tap “App battery usage” (or “Battery”) and select “Unrestricted” instead of “Optimized” or “Restricted” so medication alerts aren’t delayed.",
            shots: [
              {
                src: "/media/guides/android-app-battery.webp",
                width: 460,
                height: 776,
                alt: "Android App battery usage screen with Unrestricted selected",
                caption: "Select “Unrestricted”",
                dark: true,
              },
            ],
          },
        ],
        vendorTitle: "Setting names across Android brands",
        vendorHeaders: [
          "Phone / skin",
          "Disable unused-app hibernation",
          "Battery setting",
        ],
        vendorRows: [
          [
            "Pixel / Motorola / stock Android",
            "App info → Pause app activity if unused → Off",
            "App battery usage → Unrestricted",
          ],
          [
            "Samsung (One UI)",
            "App info → Permissions → Remove permissions if app is unused → Off",
            "Battery → Unrestricted",
          ],
          [
            "Xiaomi / Redmi / POCO (HyperOS / MIUI)",
            "App info → Pause app activity if unused → Off",
            "Battery saver → No restrictions",
          ],
        ],
      },
    },
    ios: {
      calloutTitle: "iOS requirement: install to the Home Screen first",
      calloutBody:
        "Apple only supports Web Push for web apps installed via Safari’s “Add to Home Screen” — regular Safari or Chrome tabs on iOS cannot receive Push.",
      steps: [
        {
          number: "1",
          title: "Open caremypet.pl in Safari",
          body: "Use Apple’s built-in Safari browser on your iPhone or iPad (not Chrome or an in-app browser).",
        },
        {
          number: "2",
          title: "Tap Share → “Add to Home Screen”",
          body: "Tap the Share icon at the bottom of Safari, scroll down to “Add to Home Screen”, and tap “Add”.",
        },
        {
          number: "3",
          title: "Launch Care My Pet from the new Home Screen icon",
          body: "Close Safari and open Care My Pet from the Home Screen icon, then sign in.",
        },
        {
          number: "4",
          title: "Enable Push in Schedule and run a test",
          body: "Open Schedule → “Notifications” → “Enable Push notifications” → tap Allow in iOS. Then tap “Send test Push” and lock your screen.",
        },
      ],
      unblockTitle: "Previously blocked notifications on iPhone?",
      unblockBody:
        "Open iOS Settings → Notifications → Care My Pet → enable “Allow Notifications” (including Lock Screen alerts), then return to the app.",
    },
    desktop: {
      calloutTitle: "Tip: keep email reminders enabled as a backup",
      calloutBody:
        "Push alerts are ideal for daily medication doses on your phone. For visits and vaccinations months away, keeping automatic morning email reminders enabled in the same panel adds an extra safety net.",
      cards: [
        {
          title: "Enabling Push on desktop (Chrome / Edge / Firefox / Safari)",
          body: "Open Dashboard → Schedule → “Notifications” → click “Enable Push notifications” and approve the browser prompt.",
        },
        {
          title: "Unblocking in a desktop browser",
          body: "Click the site settings icon next to the address bar on caremypet.pl → Notifications → Allow, then reload the page.",
        },
        {
          title: "OS Focus / Do Not Disturb (Windows / macOS)",
          body: "If the status is green but test alerts don’t appear, check Windows Focus Assist or macOS Focus settings to make sure browser banners are allowed.",
        },
        {
          title: "Email reminders & extra recipients",
          body: "In the same Notifications panel you can enable daily morning email digests and attach extra recipient addresses to individual schedule items.",
        },
      ],
    },
    faqTitle: "Frequently asked questions",
    faq: [
      {
        question: "Can I enable Push notifications on more than one device?",
        answer:
          "Yes. Each device (your phone, a co-guardian’s phone, and your laptop) registers its own Push subscription — just enable it once per device.",
      },
      {
        question: "I can’t see the “Send test Push” button — where is it?",
        answer:
          "It appears right below the toggle button only after Push is active on that device (green “Active on this device” badge). Tap “Enable Push notifications” first.",
      },
      {
        question: "I cleared Chrome site data or reinstalled the app and alerts stopped",
        answer:
          "Clearing site data removes the old browser subscription. Open Schedule → Notifications and tap “Enable Push notifications” again to register a fresh token.",
      },
      {
        question: "Will setting Battery to Unrestricted drain my phone?",
        answer:
          "No. Care My Pet does not run background loops — it relies on Android’s standard push delivery service (FCM), keeping battery impact near 0%.",
      },
    ],
  },
};

export const medicalReportsGuideContent: Record<
  Locale,
  MedicalReportsGuideContent
> = {
  pl: {
    metaTitle: "Skanowanie i zatwierdzanie wyników badań — Pomoc",
    metaDescription:
      "Jak dodać wyniki badań krwi lub wypis PDF/JPG/PNG w Care My Pet, odczytać je przez Gemini i zweryfikować w widoku Split-Screen przed zapisem.",
    breadcrumb: "Wyniki badań (AI)",
    eyebrow: "Poradnik 2 z 3",
    title: "Skanowanie i zatwierdzanie wyników badań",
    intro:
      "Nie musisz ręcznie przepisywać dziesiątek parametrów z kartki czy PDF-a z laboratorium. Care My Pet odczytuje dokument przez Gemini, normalizuje jednostki i pokazuje oryginał obok formularza do Twojej akceptacji.",
    readTime: "Czas czytania: ~2 min",
    calloutTitle: "Zasada bezpieczeństwa: nic nie zapisuje się automatycznie",
    calloutBody:
      "AI potrafi pomylić przecinek lub jednostkę — dlatego każdy odczyt zawsze przechodzi przez ekran weryfikacji Split-Screen. Dopiero po kliknięciu „Zapisz badanie” wartości trafiają do kartoteki pupila.",
    steps: [
      {
        number: "1",
        title: "Wybierz plik z wynikami (PDF, JPG lub PNG)",
        body: "Na Pulpicie domowym kliknij skrót „Badanie” na karcie wybranego pupila (albo wejdź w jego kartotekę → zakładka Wyniki badań → „Dodaj badanie”). Przeciągnij plik lub wybierz go z telefonu/dysku — obsługujemy PDF, JPG i PNG do 12 MB (do 10 stron w jednym PDF).",
        tip: "Przed uruchomieniem AI aplikacja automatycznie sprawdza skrót pliku (SHA-256) i ostrzeże Cię, jeśli ten sam dokument został już wcześniej dodany.",
        shots: [
          {
            src: "/media/guides/app-scan-dropzone.webp",
            width: 780,
            height: 1450,
            alt: "Ekran dodawania dokumentu badania z przyciskiem Wybierz dokument",
            caption: "Wybór pliku PDF, JPG lub PNG (maks. 12 MB)",
          },
        ],
      },
      {
        number: "2",
        title: "Uruchom odczyt z Gemini i sprawdź wynik w Split-Screen",
        body: "Po załadowaniu pliku kliknij „Odczytaj z Gemini” (możesz też wybrać „Uzupełnij ręcznie”). W kilka sekund zobaczysz ekran Split-Screen: po lewej podgląd oryginalnego dokumentu z suwakiem powiększenia, a po prawej wyodrębnioną datę badania, laboratorium, pacjenta oraz listę parametrów.",
        bullets: [
          "Wartości poza normą z dokumentu (np. podwyższona kreatynina lub mocznik) od razu dostają żółty alert „Wymaga uwagi”.",
          "Sprawdź wiersz „Pacjent odczytany z dokumentu” — chroni przed przypadkowym wgraniem badania złego zwierzaka, jeśli masz w domu kilka pupili.",
          "Każde pole (wartość, jednostka, zakres ref., nazwa parametru) możesz poprawić jednym kliknięciem.",
        ],
        shots: [
          {
            src: "/media/guides/app-scan-splitscreen.webp",
            width: 1600,
            height: 1125,
            alt: "Widok Split-Screen weryfikacji odczytu badania: po lewej oryginał z laboratorium, po prawej formularz z wyodrębnionymi parametrami",
            caption:
              "Widok Split-Screen: oryginał po lewej, edytowalny odczyt i alerty poza normą po prawej",
            wide: true,
          },
        ],
      },
      {
        number: "3",
        title: "Zatwierdź i korzystaj z porównania trendów",
        body: "Gdy dane się zgadzają, kliknij „Zapisz badanie” na dole formularza. Oryginalny plik zostaje bezpiecznie zapisany przy badaniu, a wartości liczbowe automatycznie zasilają macierz porównawczą wyników w czasie oraz kontekst Asystenta AI.",
      },
    ],
    tipsTitle: "Dobre praktyki dla najdokładniejszego odczytu",
    tips: [
      {
        title: "Jeden plik = jedno badanie",
        body: "Jeśli dostałeś w mailu dwa osobne badania z różnych dat, dodaj je jako dwa wpisy — dzięki temu wykresy i macierz trendów poprawnie przypiszą daty.",
      },
      {
        title: "Oryginalny PDF zawsze wygrywa ze zdjęciem",
        body: "Gdy laboratorium wysyła PDF, wgraj go bezpośrednio zamiast robić zdjęcie ekranu. Przy papierowym wydruku połóż kartkę płasko w dobrym świetle.",
      },
      {
        title: "Badania opisowe (USG, RTG, TK) i wypisy",
        body: "Możesz wgrywać także opisy obrazowe oraz karty wypisowe ze szpitala — aplikacja rozpozna typ dokumentu i wyciągnie kluczowe wnioski oraz zalecenia.",
      },
      {
        title: "Brakujące pola lub korekta po zapisie",
        body: "Każdy zapisany wynik możesz później otworzyć, poprawić pojedynczy parametr albo przejrzeć oryginalny załącznik obok tabeli wyników.",
      },
    ],
    faqTitle: "Pytania o odczyt dokumentów",
    faq: [
      {
        question: "Czy Care My Pet stawia diagnozę na podstawie wyników?",
        answer:
          "Nie. Aplikacja porządkuje dane, oznacza wartości spoza zakresu podanego przez laboratorium i pomaga przygotować pytania na wizytę — interpretacja medyczna zawsze należy do lekarza weterynarii.",
      },
      {
        question: "Co jeśli AI nie odczyta jednego wiersza albo pomyli jednostkę?",
        answer:
          "Na ekranie Split-Screen możesz poprawić każdą wartość, usunąć błędny wiersz lub kliknąć „+ Dodaj parametr”, zanim zapiszesz badanie.",
      },
    ],
  },
  en: {
    metaTitle: "Scanning & reviewing lab results — Help",
    metaDescription:
      "How to upload lab PDFs or photos in Care My Pet, run Gemini extraction, and verify every parameter side-by-side in Split-Screen before saving.",
    breadcrumb: "Lab results (AI)",
    eyebrow: "Guide 2 of 3",
    title: "Scanning & reviewing lab results",
    intro:
      "Skip typing dozens of lab parameters by hand. Care My Pet extracts values and reference ranges with Gemini, normalizes units, and shows the original scan side-by-side for your approval.",
    readTime: "Read time: ~2 min",
    calloutTitle: "Safety rule: nothing is saved automatically",
    calloutBody:
      "AI can misread a decimal or unit — every extraction always opens in Split-Screen review first. Values enter your pet’s record only after you click “Save report”.",
    steps: [
      {
        number: "1",
        title: "Pick a document (PDF, JPG, or PNG)",
        body: "Click the quick “Report” button on a pet’s dashboard card (or open the pet record → Results → “Add report”). Drop or pick a PDF, JPG, or PNG up to 12 MB (up to 10 pages per PDF).",
        tip: "Before calling AI, the app checks the file’s SHA-256 fingerprint and warns you if the exact same document is already saved.",
        shots: [
          {
            src: "/media/guides/app-scan-dropzone.webp",
            width: 780,
            height: 1450,
            alt: "Document upload screen with Choose document button",
            caption: "Upload PDF, JPG, or PNG (max 12 MB)",
          },
        ],
      },
      {
        number: "2",
        title: "Run Gemini extraction and verify in Split-Screen",
        body: "Click “Extract with Gemini” (or choose manual entry). Within seconds Split-Screen opens with the zoomable original document on the left and editable header fields and parameters on the right.",
        bullets: [
          "Out-of-range values from the lab sheet are immediately highlighted with a warning banner.",
          "Check the “Patient extracted from document” line to prevent saving a report under the wrong pet in multi-pet households.",
          "Every value, unit, reference range, and parameter name can be edited before saving.",
        ],
        shots: [
          {
            src: "/media/guides/app-scan-splitscreen.webp",
            width: 1600,
            height: 1125,
            alt: "Split-Screen verification view with lab report scan on the left and extracted parameters on the right",
            caption:
              "Split-Screen review: original scan on the left, editable values and out-of-range flags on the right",
            wide: true,
          },
        ],
      },
      {
        number: "3",
        title: "Confirm and track trends over time",
        body: "When everything matches the original sheet, click “Save report”. The original attachment stays archived with the report while numeric parameters feed the longitudinal comparison matrix and AI Assistant context.",
      },
    ],
    tipsTitle: "Best practices for accurate extraction",
    tips: [
      {
        title: "One file = one report",
        body: "Upload separate lab dates as separate entries so trend charts and the comparison matrix align dates accurately.",
      },
      {
        title: "Original PDF beats a phone photo",
        body: "If the clinic emailed a PDF, upload it directly. When photographing paper printouts, lay the page flat in even lighting.",
      },
      {
        title: "Imaging reports (US, X-ray, CT) & discharge notes",
        body: "You can also upload descriptive imaging reports and multi-page clinic discharge summaries.",
      },
      {
        title: "Edits after saving",
        body: "You can reopen any saved report later to adjust a value or inspect the original attached file.",
      },
    ],
    faqTitle: "Document scanning FAQ",
    faq: [
      {
        question: "Does Care My Pet diagnose my pet from lab values?",
        answer:
          "No. It organizes records, highlights out-of-range numbers from the lab sheet, and helps you prepare questions — medical interpretation always belongs to your veterinarian.",
      },
      {
        question: "What if AI misses a row or misreads a unit?",
        answer:
          "In Split-Screen you can edit any field, remove an extra row, or click “+ Add parameter” before saving.",
      },
    ],
  },
};

export const sharingRecoveryGuideContent: Record<
  Locale,
  SharingRecoveryGuideContent
> = {
  pl: {
    metaTitle: "Udostępnianie weterynarzowi i Klucz Odzyskiwania — Pomoc",
    metaDescription:
      "Jak wygenerować tymczasowy link lub kod QR do kartoteki pupila dla weterynarza oraz jak bezpiecznie utworzyć i przechować Klucz Odzyskiwania gospodarstwa.",
    breadcrumb: "Udostępnianie i bezpieczeństwo",
    eyebrow: "Poradnik 3 z 3",
    title: "Udostępnianie weterynarzowi i Klucz Odzyskiwania",
    intro:
      "Dwie funkcje, które najbardziej przydają się w praktyce: błyskawiczne pokazanie pełnej historii choroby lekarzowi w gabinecie oraz zabezpieczenie konta domowego na wypadek utraty dostępu.",
    readTime: "Czas czytania: ~2 min",
    vetSection: {
      eyebrow: "Część 1 — W gabinecie",
      title: "Tymczasowy link lub kod QR dla lekarza weterynarii",
      intro:
        "Lekarz nie musi zakładać konta ani niczego instalować. Otrzymuje wyłącznie podgląd kartoteki jednego wybranego pupila w trybie tylko do odczytu — na dokładnie określony czas.",
      steps: [
        {
          number: "1",
          title: "Wygeneruj link i kod QR w kartotece pupila",
          body: "Otwórz kartotekę wybranego pupila i kliknij przycisk „Udostępnij weterynarzowi” w górnej części ekranu. Wybierz czas ważności (1 godzina, 24 godziny lub 7 dni), opcjonalnie dopisz etykietę (np. nazwę kliniki) i kliknij „Utwórz link i kod QR”.",
          bullets: [
            "W gabinecie po prostu pokaż ekran z kodem QR — lekarz zeskanuje go telefonem lub tabletem.",
            "Przed konsultacją online kliknij „Kopiuj link” i wyślij go mailem lub w komunikatorze kliniki.",
            "W tym samym oknie widzisz licznik otwarć, czas wygaśnięcia i możesz unieważnić link jednym kliknięciem.",
          ],
          shots: [
            {
              src: "/media/guides/app-share-qr.webp",
              width: 716,
              height: 1624,
              alt: "Okno Udostępnij kartotekę z wyborem ważności linku oraz wygenerowanym kodem QR",
              caption: "Wybór ważności, kod QR i szybkie kopiowanie linku",
            },
          ],
        },
      ],
    },
    recoverySection: {
      eyebrow: "Część 2 — Gospodarstwo i bezpieczeństwo",
      title: "Współopiekunowie i Jednorazowy Klucz Odzyskiwania",
      intro:
        "W zakładce „Gospodarstwo” w górnym pasku zaprosisz domowników do wspólnej opieki (z synchronizacją odhaczanych leków na żywo) oraz zarządzasz bezpieczeństwem dostępu.",
      calloutTitle: "Dlaczego na starcie wymagamy wygenerowania Klucza Odzyskiwania?",
      calloutBody:
        "Kartoteka zdrowia pupila bywa gromadzona latami. Jednorazowy Klucz Odzyskiwania (wzorzec Apple Legacy Contact) gwarantuje, że jeśli stracisz dostęp do konta lub skrzynki e-mail, Ty albo zaufany domownik bezpiecznie odzyskacie pełną kartotekę przez formularz /recover. Bez aktywnego klucza domostwo działa wyłącznie w trybie odczytu.",
      steps: [
        {
          number: "1",
          title: "Otwórz zakładkę „Gospodarstwo” i sekcję Bezpieczeństwo",
          body: "Kliknij „Gospodarstwo” w górnym menu aplikacji. Znajdziesz tam formularz zaproszenia współopiekuna (partnera lub członka rodziny) oraz kartę „Bezpieczeństwo i klucz odzyskania dostępu”.",
          shots: [
            {
              src: "/media/guides/app-recovery-section.webp",
              width: 780,
              height: 1688,
              alt: "Widok Gospodarstwa z formularzem zaproszenia współopiekuna i sekcją Klucza Odzyskiwania",
              caption: "Zapraszanie domowników i status Klucza Odzyskiwania",
            },
          ],
        },
        {
          number: "2",
          title: "Wygeneruj klucz i pobierz gotową kartę PDF",
          body: "Kliknij „Wygeneruj klucz odzyskania” (lub przycisk na banerze startowym). Wygenerowany kod zobaczysz tylko jeden raz — serwer przechowuje wyłącznie bezpieczny skrót kryptograficzny. Pobierz gotową kartę A4 PDF, wydrukuj ją lub zapisz w menedżerze haseł i potwierdź zapisanie.",
          tip: "Klucz możesz w każdej chwili zrotować (wygenerować nowy) — poprzedni staje się wtedy natychmiast nieważny.",
          shots: [
            {
              src: "/media/guides/app-recovery-dialog.webp",
              width: 716,
              height: 1108,
              alt: "Okno z przykładowym jednorazowym Kluczem Odzyskiwania i przyciskiem Pobierz kartę PDF",
              caption: "Jednorazowy podgląd klucza (na zrzucie przykładowy kod demo) i pobranie karty PDF",
            },
          ],
        },
      ],
    },
    faqTitle: "Pytania o udostępnianie i odzyskiwanie dostępu",
    faq: [
      {
        question: "Czy lekarz otwierający link QR widzi pozostałe zwierzęta w moim domu?",
        answer:
          "Nie. Link jest przypisany wyłącznie do jednego konkretnego pupila i daje tylko prawo odczytu (bez edycji, bez dostępu do ustawień konta i bez pozostałych kartotek).",
      },
      {
        question: "Czym różni się rola Współopiekuna od Współadministratora?",
        answer:
          "Współopiekun może przeglądać kartoteki, odhaczać podane leki, dodawać wpisy zdrowia i wyniki badań. Współadministrator dodatkowo zarządza profilami pupili i zaproszeniami, natomiast operacje właścicielskie (np. rotacja Klucza Odzyskiwania) pozostają przy właścicielu.",
      },
      {
        question: "Zgubiłem kartę PDF z Kluczem Odzyskiwania, ale mam dostęp do konta — co zrobić?",
        answer:
          "Wejdź w Gospodarstwo → „Rotuj / wygeneruj nowy klucz”. Wygenerujesz świeżą kartę PDF, a zgubiony kod natychmiast przestanie działać.",
      },
    ],
  },
  en: {
    metaTitle: "Vet sharing & Recovery Key — Help",
    metaDescription:
      "How to create a temporary read-only link or QR code for your vet and how to safely generate and store your household Recovery Key.",
    breadcrumb: "Sharing & security",
    eyebrow: "Guide 3 of 3",
    title: "Vet sharing & Recovery Key",
    intro:
      "Two practical essentials: handing your vet a pet’s full history with one QR scan during a visit, and protecting your household records against permanent account lockout.",
    readTime: "Read time: ~2 min",
    vetSection: {
      eyebrow: "Part 1 — At the clinic",
      title: "Temporary link or QR code for your veterinarian",
      intro:
        "Your vet does not need an account or an app. The link opens a clean read-only view of one selected pet for the exact duration you choose.",
      steps: [
        {
          number: "1",
          title: "Generate a link & QR code from the pet’s record",
          body: "Open the pet’s record and tap “Share with vet” near the top. Choose how long it stays valid (1 hour, 24 hours, or 7 days), optionally add a clinic label, and tap “Create link & QR code”.",
          bullets: [
            "At the clinic, let your vet scan the QR code directly off your phone screen.",
            "Before a remote consultation, tap “Copy link” and send it by email or message.",
            "You can see how many times it was opened and revoke it instantly at any time.",
          ],
          shots: [
            {
              src: "/media/guides/app-share-qr.webp",
              width: 716,
              height: 1624,
              alt: "Share record dialog showing link expiration selector and generated QR code",
              caption: "Expiration selector, QR code, and one-tap copy",
            },
          ],
        },
      ],
    },
    recoverySection: {
      eyebrow: "Part 2 — Household & security",
      title: "Co-guardians and One-Time Recovery Key",
      intro:
        "In the “Household” tab you can invite family members for live shared care (including real-time medication check-offs) and manage account recovery.",
      calloutTitle: "Why is generating a Recovery Key required on setup?",
      calloutBody:
        "Pet medical histories build up over years. A one-time Recovery Key (modeled after Apple Legacy Contact) ensures that if you ever lose access to your login or email inbox, you or a trusted family member can recover the household via /recover. Without an active key, the household stays read-only.",
      steps: [
        {
          number: "1",
          title: "Open “Household” → Security & recovery key",
          body: "Click “Household” in the top navigation bar to invite co-guardians and view the “Security & access recovery key” card.",
          shots: [
            {
              src: "/media/guides/app-recovery-section.webp",
              width: 780,
              height: 1688,
              alt: "Household view with co-guardian invite form and Recovery Key security section",
              caption: "Inviting co-guardians and Recovery Key status",
            },
          ],
        },
        {
          number: "2",
          title: "Generate your key and download the A4 PDF card",
          body: "Tap “Generate recovery key”. The key is shown only once — the server stores only a cryptographic hash. Download the printable A4 PDF card (or store it in your password manager) and confirm you saved it.",
          tip: "You can rotate the key at any time — generating a new one immediately invalidates the previous key.",
          shots: [
            {
              src: "/media/guides/app-recovery-dialog.webp",
              width: 716,
              height: 1108,
              alt: "Dialog displaying a sample demo Recovery Key with Download PDF card button",
              caption: "One-time key view (demo key shown) and PDF card download",
            },
          ],
        },
      ],
    },
    faqTitle: "Sharing & recovery FAQ",
    faq: [
      {
        question: "Can the vet see my other pets through the shared QR link?",
        answer:
          "No. Each share token is scoped strictly to one pet in read-only mode, with no access to other pets or household settings.",
      },
      {
        question: "What is the difference between a Co-guardian and a Co-admin?",
        answer:
          "Co-guardians can view records, log medications, and add visits or lab results. Co-admins can also manage pet profiles and invitations, while owner-level security actions (such as rotating the Recovery Key) stay with the owner.",
      },
      {
        question: "I misplaced my PDF Recovery Key card, but I can still sign in — what now?",
        answer:
          "Go to Household → “Rotate / generate new key”. You will get a fresh PDF card and the lost key is invalidated immediately.",
      },
    ],
  },
};
