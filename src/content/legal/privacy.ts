import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_OPERATOR,
  legalOperatorBlock,
} from "@/content/legal/operator"

export const PRIVACY_INTRO = [
  `Niniejsza Polityka prywatności określa zasady przetwarzania danych osobowych w związku z korzystaniem z platformy ${LEGAL_OPERATOR.serviceName} (${LEGAL_OPERATOR.serviceUrl}).`,
  "Dokument obowiązuje wobec Użytkowników panelu, osób zapraszanych do zespołu oraz — w zakresie w nim opisanym — Klientów końcowych korzystających z publicznej rezerwacji u Firm korzystających z platformy.",
  "Korzystając z serwisu, akceptujesz zasady opisane poniżej. W sprawach dotyczących danych Klientów końcowych administratorem co do zasady pozostaje Firma/Organizacja korzystająca z platformy.",
]

export const PRIVACY_SECTIONS: Array<{ title: string; paragraphs: string[] }> = [
  {
    title: "1. Administrator danych i kontakt",
    paragraphs: [
      `Administratorem danych osobowych Użytkowników platformy ${LEGAL_OPERATOR.serviceName} (konta panelu, rozliczenia, support) jest ${legalOperatorBlock()}.`,
      `W sprawach ochrony danych osobowych można kontaktować się pod adresem: ${LEGAL_OPERATOR.privacyEmail}.`,
      "Wnioski dotyczące realizacji praw RODO prosimy kierować z opisem żądania oraz informacją umożliwiającą weryfikację tożsamości wnioskodawcy.",
    ],
  },
  {
    title: "2. Role: administrator i podmiot przetwarzający",
    paragraphs: [
      `Dla danych konta Użytkownika, konfiguracji Firmy/Organizacji, rozliczeń abonamentu i zgłoszeń supportu administratorem jest ${LEGAL_OPERATOR.operatorName}.`,
      "Dla danych Klientów końcowych wprowadzanych przez Firmę/Organizację (np. imię, telefon, e-mail, historia wizyt) administratorem co do zasady jest ta Firma/Organizacja.",
      `${LEGAL_OPERATOR.operatorName} przetwarza te dane jako podmiot przetwarzający wyłącznie w celu świadczenia usługi SaaS, na podstawie umowy z Firmą/Organizacją (w tym umowy powierzenia przetwarzania danych — DPA).`,
      "Szczegóły powierzenia i obowiązki stron mogą być określone w odrębnej umowie DPA udostępnianej Firmom/Organizacjom korzystającym z platformy.",
    ],
  },
  {
    title: "3. Zakres platformy",
    paragraphs: [
      `${LEGAL_OPERATOR.serviceName} to platforma SaaS umożliwiająca m.in.: rezerwacje online, panel wizyt, zarządzanie klientami, zespołem, grafikiem, wiadomościami SMS/e-mail, statystykami, integracjami (w tym Google Calendar), program poleceń oraz — w zależności od planu — płatności abonamentowe.`,
      "Zakres funkcji może ewoluować; o istotnych zmianach wpływających na przetwarzanie danych informujemy poprzez aktualizację niniejszej Polityki.",
    ],
  },
  {
    title: "4. Jakie dane przetwarzamy",
    paragraphs: [
      "Dane konta Użytkownika: adres e-mail, hasło (hash), identyfikatory techniczne konta, metadane logowania (w tym OAuth Google/Facebook jeśli użyty), preferencje języka i interfejsu.",
      "Dane Firmy/Organizacji: nazwa, slug publicznej strony, adres, telefon, godziny otwarcia, ustawienia branży, logo, konfiguracja powiadomień, dane rozliczeniowe.",
      "Dane zespołu: imię i nazwisko, rola, przypisane usługi, identyfikatory konta, wyjątki grafiku.",
      "Dane Klientów końcowych: imię, nazwisko, telefon, e-mail, notatki, status klienta, historia i planowane wizyty, załączniki jeśli włączone.",
      "Dane wizyt/rezerwacji: usługa, termin, status, przypisany pracownik, źródło rezerwacji, identyfikatory powiązań technicznych.",
      "Dane komunikacji: treść i metadane wiadomości SMS/e-mail, statusy doręczenia, logi wysyłek, harmonogramy przypomnień, szablony wiadomości.",
      "Dane integracji Google Calendar (po dobrowolnym połączeniu przez Użytkownika): e-mail konta Google, identyfikator wybranego kalendarza, zaszyfrowany refresh token OAuth, identyfikatory wydarzeń kalendarza powiązanych z wizytami.",
      "Dane płatności abonamentu: identyfikatory klienta i subskrypcji Stripe, status płatności, okres rozliczeniowy — nie przechowujemy pełnych numerów kart (obsługę kart prowadzi Stripe).",
      "Dane programu poleceń: kody polecające, identyfikatory poleceń, statusy rejestracji i trialu powiązane z programem.",
      "Dane supportu: treść zgłoszeń, korespondencja, logi czatu wsparcia.",
      "Dane techniczne: adres IP, user agent, logi błędów, identyfikatory sesji, znaczniki czasu, pliki cookies niezbędne do działania serwisu.",
    ],
  },
  {
    title: "5. Cele i podstawy prawne przetwarzania",
    paragraphs: [
      "Założenie i prowadzenie konta, świadczenie usługi SaaS — art. 6 ust. 1 lit. b RODO (umowa).",
      "Publiczna rezerwacja i obsługa wizyt na zlecenie Firmy/Organizacji — art. 6 ust. 1 lit. b RODO (umowa z administratorem po stronie Firmy) oraz art. 28 RODO (powierzenie).",
      "Wysyłka powiadomień i przypomnień skonfigurowanych przez Firmę — art. 6 ust. 1 lit. b RODO i/lit. f RODO (prawnie uzasadniony interes Firmy); w razie wymogu marketingu bez umowy — zgoda.",
      "Integracja Google Calendar — art. 6 ust. 1 lit. a RODO (zgoda Użytkownika wyrażona przez OAuth) oraz art. 6 ust. 1 lit. b RODO (realizacja funkcji wybranej przez Użytkownika).",
      "Rozliczenia abonamentu, faktury, obsługa płatności — art. 6 ust. 1 lit. b RODO oraz art. 6 ust. 1 lit. c RODO (obowiązki podatkowo-księgowe).",
      "Bezpieczeństwo, diagnostyka, zapobieganie nadużyciom, dochodzenie roszczeń — art. 6 ust. 1 lit. f RODO.",
      "Support i komunikacja z Użytkownikiem — art. 6 ust. 1 lit. b RODO i/lit. f RODO.",
      "Analityka produktowa w zakresie niezbędnym do utrzymania serwisu — art. 6 ust. 1 lit. f RODO; cookies analityczne/marketingowe — wyłącznie po uzyskaniu zgody, jeśli zostaną wdrożone.",
    ],
  },
  {
    title: "6. Źródła danych",
    paragraphs: [
      "Dane pochodzą bezpośrednio od Użytkownika, od Firmy/Organizacji, od Klientów końcowych (formularz rezerwacji), z integracji dobrowolnie połączonych (Google Calendar) oraz automatycznie z urządzenia/przeglądarki (logi techniczne).",
    ],
  },
  {
    title: "7. Odbiorcy danych (procesorzy)",
    paragraphs: [
      "Hosting i infrastruktura aplikacji (np. Vercel).",
      "Supabase — baza danych, uwierzytelnianie, przechowywanie danych aplikacji.",
      "Resend lub równoważny dostawca — wysyłka e-mail transakcyjnych.",
      "Dostawcy SMS (np. SMSAPI, SzybkiSMS lub inny skonfigurowany operator) — wysyłka SMS.",
      "Stripe — obsługa płatności abonamentu.",
      "Google LLC — Google Calendar API i OAuth (po połączeniu konta przez Użytkownika).",
      "Meta Platforms — logowanie OAuth Facebook (jeśli Użytkownik wybierze tę metodę).",
      "Dostawcy wsparcia technicznego, księgowości i doradztwa — w niezbędnym zakresie.",
      "Organy publiczne — gdy wynika to z przepisów prawa.",
    ],
  },
  {
    title: "8. Przekazywanie danych poza Europejski Obszar Gospodarczy",
    paragraphs: [
      "Część dostawców technologicznych może przetwarzać dane poza EOG (np. w USA).",
      "W takich przypadkach stosujemy mechanizmy zgodne z RODO, w szczególności standardowe klauzule umowne (SCC) lub inne podstawy przewidziane przepisami.",
      "Szczegółowe informacje o transferach można uzyskać kontaktując się pod adresem: " + LEGAL_OPERATOR.privacyEmail + ".",
    ],
  },
  {
    title: "9. Okres przechowywania danych",
    paragraphs: [
      "Dane konta Użytkownika — przez okres korzystania z platformy i do 24 miesięcy po usunięciu konta, chyba że dłuższy okres wynika z przepisów lub dochodzenia roszczeń.",
      "Dane Klientów końcowych i wizyt — przez okres korzystania z platformy przez Firmę/Organizację oraz zgodnie z instrukcją Firmy/Organizacji po zakończeniu umowy; domyślnie do 24 miesięcy po zamknięciu konta Firmy, o ile Firma nie żąda wcześniejszego usunięcia.",
      "Logi techniczne i bezpieczeństwa — zwykle do 12 miesięcy.",
      "Dane rozliczeniowe — przez okres wymagany przepisami podatkowymi i rachunkowymi (co do zasady 5 lat od końca roku podatkowego).",
      "Tokeny Google Calendar — do momentu rozłączenia integracji lub usunięcia konta; refresh token przechowywany w formie zaszyfrowanej.",
      "Po upływie okresów dane są usuwane lub anonimizowane, o ile przepisy nie wymagają dalszego przechowywania.",
    ],
  },
  {
    title: "10. Prawa osób, których dane dotyczą",
    paragraphs: [
      "Przysługuje Ci prawo: dostępu do danych, sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych, sprzeciwu wobec przetwarzania opartego na art. 6 ust. 1 lit. f RODO.",
      "Jeżeli przetwarzanie odbywa się na podstawie zgody — prawo cofnięcia zgody w dowolnym momencie (bez wpływu na zgodność z prawem przetwarzania przed cofnięciem).",
      "Prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl).",
      "Wnioski dotyczące danych przetwarzanych w panelu Użytkownika realizujemy pod adresem: " + LEGAL_OPERATOR.privacyEmail + ".",
      "Wnioski Klientów końcowych dotyczących wizyt u konkretnej Firmy co do zasady należy kierować do tej Firmy/Organizacji jako administratora tych danych; pomożemy Firmie w realizacji obowiązków jako podmiot przetwarzający.",
    ],
  },
  {
    title: "11. Obowiązek podania danych",
    paragraphs: [
      "Podanie danych niezbędnych do założenia konta i świadczenia usługi jest dobrowolne, lecz konieczne do korzystania z platformy.",
      "Brak podania danych wymaganych do rezerwacji uniemożliwia dokonanie rezerwacji online u danej Firmy.",
    ],
  },
  {
    title: "12. Zautomatyzowane decyzje i profilowanie",
    paragraphs: [
      "Nie podejmujemy wobec Ciebie decyzji w sposób wyłącznie zautomatyzowany, które wywoływałyby skutki prawne lub w podobny sposób istotnie na Ciebie wpływały.",
      "Funkcje statystyczne w panelu służą wyłącznie prezentacji danych wprowadzonych przez Firmę/Organizację.",
    ],
  },
  {
    title: "13. Bezpieczeństwo danych",
    paragraphs: [
      "Stosujemy środki techniczne i organizacyjne adekwatne do ryzyka, m.in.: szyfrowanie transmisji (HTTPS), kontrolę dostępu, separację środowisk, szyfrowanie tokenów integracji, kopie zapasowe, logowanie zdarzeń.",
      "Hasła Użytkowników przechowywane są w formie hash; nie mamy do nich dostępu w postaci jawnej.",
      "Mimo stosowanych środków żaden system informatyczny nie gwarantuje absolutnego bezpieczeństwa.",
    ],
  },
  {
    title: "14. Integracja Google Calendar",
    paragraphs: [
      "Połączenie kalendarza Google jest dobrowolne i inicjowane wyłącznie przez Użytkownika w ustawieniach integracji.",
      "W ramach integracji przetwarzamy dane niezbędne do utworzenia, aktualizacji lub oznaczenia anulowanych wydarzeń wizyt w wybranym kalendarzu Użytkownika.",
      "Refresh token OAuth przechowywany jest zaszyfrowany po stronie serwera; Użytkownik może w każdej chwili rozłączyć integrację w panelu lub cofnąć dostęp w ustawieniach konta Google.",
      "Szczegóły scope’ów OAuth i sposobu synchronizacji opisuje dokumentacja integracji w panelu ustawień.",
    ],
  },
  {
    title: "15. Logowanie przez Google / Facebook",
    paragraphs: [
      "Jeżeli logujesz się do panelu przez Google lub Facebook (Supabase Auth), otrzymujemy od dostawcy identyfikator konta i — w zależności od ustawień — adres e-mail.",
      "To odrębne od integracji Google Calendar; logowanie do aplikacji nie daje automatycznie dostępu do kalendarza.",
      "Zasady przetwarzania po stronie Google/Meta określają odpowiednio polityki tych dostawców.",
    ],
  },
  {
    title: "16. Pliki cookies i local storage",
    paragraphs: [
      "Serwis korzysta z cookies i local storage niezbędnych do działania (sesja, preferencje języka, motywu, tokeny uwierzytelniania).",
      "Cookies analityczne lub marketingowe — jeśli zostaną wdrożone — będą używane wyłącznie z odpowiednią podstawą prawną (np. zgoda).",
      "Możesz zarządzać cookies w ustawieniach przeglądarki; wyłączenie cookies niezbędnych może ograniczyć działanie serwisu.",
    ],
  },
  {
    title: "17. Dane dzieci",
    paragraphs: [
      `${LEGAL_OPERATOR.serviceName} nie jest skierowany do dzieci poniżej 16. roku życia.`,
      "Nie gromadzimy świadomie danych dzieci w celu założenia konta panelu. Jeżeli stwierdzimy naruszenie, usuniemy dane w rozsądnym terminie.",
      "Dane nieletnich Klientów końcowych mogą być przetwarzane przez Firmy/Organizacje wyłącznie zgodnie z ich obowiązkami prawnymi.",
    ],
  },
  {
    title: "18. Zmiany Polityki prywatności",
    paragraphs: [
      "Polityka może być aktualizowana w razie zmian prawnych, technologicznych lub funkcjonalnych platformy.",
      `Nowa wersja obowiązuje od daty publikacji w serwisie, o ile nie wskazano innej daty wejścia w życie. O istotnych zmianach możemy poinformować w panelu lub e-mailem.`,
      `Aktualna wersja obowiązuje od ${LEGAL_EFFECTIVE_DATE}.`,
    ],
  },
  {
    title: "19. Kontakt",
    paragraphs: [
      `${LEGAL_OPERATOR.operatorName}`,
      `E-mail (RODO, prywatność): ${LEGAL_OPERATOR.privacyEmail}`,
      `Serwis: ${LEGAL_OPERATOR.serviceUrl}`,
      "Formularz kontaktu i czat wsparcia: dostępne w panelu aplikacji oraz na stronie /developer-contact.",
    ],
  },
]
