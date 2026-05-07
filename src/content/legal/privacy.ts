export const PRIVACY_DRAFT_BADGE =
  "Dokument roboczy - wymaga uzupełnienia danych operatora przed startem komercyjnym"

export const PRIVACY_DRAFT_VERSION = "Wersja robocza: [DATA DO UZUPEŁNIENIA]"

export const PRIVACY_INTRO = [
  "Niniejsza Polityka prywatności opisuje zasady przetwarzania danych osobowych w związku z korzystaniem z WizytaOK.",
  "Przed komercyjnym uruchomieniem dokument wymaga uzupełnienia danych Operatora i finalnej weryfikacji prawnej, w tym przygotowania dokumentacji powierzenia przetwarzania danych (DPA).",
]

export const PRIVACY_SECTIONS: Array<{ title: string; paragraphs: string[] }> = [
  {
    title: "1. Informacje ogólne",
    paragraphs: [
      "WizytaOK jest usługą cyfrową (SaaS) wspierającą firmy usługowe w obsłudze rezerwacji, wizyt, zespołu, klientów i komunikacji.",
      "Przetwarzanie danych odbywa się zgodnie z RODO, krajowymi przepisami o ochronie danych i innymi właściwymi regulacjami.",
    ],
  },
  {
    title: "2. Administrator danych",
    paragraphs: [
      "Administratorem danych w zakresie danych kont Użytkowników WizytaOK jest Operator: [DANE OPERATORA DO UZUPEŁNIENIA PRZED STARTEM KOMERCYJNYM], [NAZWA FIRMY], [ADRES], [NIP], [REGON], [E-MAIL KONTAKTOWY].",
      "Przed startem komercyjnym należy uzupełnić wszystkie dane identyfikacyjne administratora.",
    ],
  },
  {
    title: "3. Ważne rozróżnienie ról (administrator / podmiot przetwarzający)",
    paragraphs: [
      "Dla danych kont Użytkowników WizytaOK co do zasady administratorem jest Operator.",
      "Dla danych Klientów końcowych wprowadzanych przez Firmę/Organizację administratorem może być ta Firma/Organizacja, a WizytaOK może działać jako podmiot przetwarzający.",
      "Przed startem komercyjnym należy przygotować i wdrożyć umowę powierzenia przetwarzania danych (DPA) lub równoważny mechanizm.",
    ],
  },
  {
    title: "4. Jakie dane przetwarzamy",
    paragraphs: [
      "Dane konta Użytkownika (np. e-mail logowania, identyfikatory konta, ustawienia).",
      "Dane Firmy/Organizacji (np. nazwa, dane kontaktowe, dane konfiguracyjne).",
      "Dane zespołu (np. imię i nazwisko, rola, kontakt służbowy).",
      "Dane Klientów końcowych (np. imię, nazwisko, telefon, e-mail, notatki, historia wizyt).",
      "Dane wizyt i rezerwacji (np. usługa, termin, status, źródło rezerwacji).",
      "Dane związane z wiadomościami SMS/e-mail (np. statusy wysyłki, harmonogramy, logi techniczne).",
      "Dane techniczne i bezpieczeństwa (np. logi systemowe, identyfikatory sesji, informacje diagnostyczne).",
      "Dane supportu/live chat (np. treść zgłoszeń, metadane kontaktu).",
    ],
  },
  {
    title: "5. Cele przetwarzania danych",
    paragraphs: [
      "Prowadzenie konta i realizacja funkcji aplikacji.",
      "Obsługa rezerwacji, kalendarza, grafiku i komunikacji z Klientami końcowymi.",
      "Wysyłka powiadomień i przypomnień SMS/e-mail zgodnie z konfiguracją.",
      "Bezpieczeństwo, zapobieganie nadużyciom oraz utrzymanie stabilności usługi.",
      "Obsługa supportu i kontaktu technicznego.",
      "Rozliczenia i dokumentacja księgowa - jeżeli i gdy zostaną uruchomione funkcje komercyjne.",
      "Działania marketingowe wyłącznie na podstawie właściwej podstawy prawnej (np. zgody), jeśli będą realizowane.",
    ],
  },
  {
    title: "6. Podstawy prawne przetwarzania",
    paragraphs: [
      "Wykonanie umowy lub działania przed zawarciem umowy (art. 6 ust. 1 lit. b RODO).",
      "Wypełnienie obowiązku prawnego (art. 6 ust. 1 lit. c RODO).",
      "Prawnie uzasadniony interes administratora, np. bezpieczeństwo i dochodzenie roszczeń (art. 6 ust. 1 lit. f RODO).",
      "Zgoda, gdy jest wymagana (art. 6 ust. 1 lit. a RODO), z prawem jej wycofania.",
    ],
  },
  {
    title: "7. Odbiorcy danych",
    paragraphs: [
      "Dostawcy hostingu i infrastruktury technicznej.",
      "Supabase (w zakresie hostowania backendu i danych).",
      "Dostawcy SMS i e-mail używani do komunikacji.",
      "Dostawcy narzędzi technicznych, analitycznych i supportowych, jeśli są używani.",
      "Podmioty księgowe i doradcze, jeśli są zaangażowane.",
      "Uprawnione organy publiczne, gdy wynika to z przepisów prawa.",
    ],
  },
  {
    title: "8. Przekazywanie danych poza EOG",
    paragraphs: [
      "W związku z wykorzystaniem usług technologicznych dane mogą być przekazywane poza EOG.",
      "W takim przypadku stosowane są odpowiednie mechanizmy legalizujące transfer, np. standardowe klauzule umowne lub inne podstawy zgodne z RODO.",
    ],
  },
  {
    title: "9. Czas przechowywania danych",
    paragraphs: [
      "Dane przechowujemy przez okres niezbędny do realizacji celów przetwarzania i zgodnie z obowiązkami prawnymi.",
      "Okres przechowywania może zależeć od rodzaju danych, statusu konta, wymagań księgowych, bezpieczeństwa i przedawnienia roszczeń.",
    ],
  },
  {
    title: "10. Prawa osób, których dane dotyczą",
    paragraphs: [
      "Prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania i przenoszenia danych.",
      "Prawo wniesienia sprzeciwu wobec przetwarzania realizowanego na podstawie prawnie uzasadnionego interesu.",
      "Prawo cofnięcia zgody w dowolnym momencie, jeśli przetwarzanie odbywa się na podstawie zgody.",
      "Prawo wniesienia skargi do Prezesa UODO.",
      "Żądania można kierować na adres: [E-MAIL KONTAKTOWY].",
    ],
  },
  {
    title: "11. Cookies i podobne technologie",
    paragraphs: [
      "WizytaOK korzysta z technologii niezbędnych do działania serwisu (np. cookies techniczne, local storage, tokeny sesji).",
      "Jeżeli zostaną wdrożone cookies analityczne lub marketingowe, będą obsługiwane zgodnie z właściwą podstawą prawną, w tym zgodą, jeśli jest wymagana.",
    ],
  },
  {
    title: "12. Logi techniczne i bezpieczeństwo",
    paragraphs: [
      "Dla zapewnienia bezpieczeństwa i stabilności usługi możemy gromadzić logi techniczne i zdarzenia systemowe.",
      "Logi mogą zawierać m.in. informacje o błędach, próbach logowania, aktywnościach administracyjnych i metadane techniczne.",
    ],
  },
  {
    title: "13. Dane dzieci",
    paragraphs: [
      "WizytaOK nie jest kierowana do dzieci.",
      "Jeżeli stwierdzimy, że dane zostały podane niezgodnie z prawem, podejmiemy odpowiednie działania, w tym usunięcie danych, jeśli będzie to zasadne.",
    ],
  },
  {
    title: "14. Zautomatyzowane decyzje i profilowanie",
    paragraphs: [
      "Nie stosujemy zautomatyzowanego podejmowania decyzji wywołującego skutki prawne lub w podobny sposób istotnie wpływającego na osoby, których dane dotyczą.",
    ],
  },
  {
    title: "15. Zmiany Polityki prywatności",
    paragraphs: [
      "Polityka prywatności może być aktualizowana, zwłaszcza przy zmianach prawnych, technologicznych lub funkcjonalnych.",
      "Nowa wersja będzie publikowana w aplikacji wraz z informacją o dacie wejścia w życie: [DATA WEJŚCIA W ŻYCIE].",
    ],
  },
  {
    title: "16. Kontakt",
    paragraphs: [
      "W sprawach związanych z ochroną danych skontaktuj się: [E-MAIL KONTAKTOWY].",
      "Dane Operatora do uzupełnienia przed startem komercyjnym: [DANE OPERATORA DO UZUPEŁNIENIA PRZED STARTEM KOMERCYJNYM].",
    ],
  },
]
