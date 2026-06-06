import { LEGAL_BETA_OPERATOR_PUBLIC_NOTICE } from "@/content/legal/beta-notice"

export const TERMS_DRAFT_BADGE = "Wersja beta"

export const TERMS_DRAFT_VERSION = "Obowiązuje w okresie wczesnego dostępu."

export const TERMS_INTRO = [
  "Niniejszy Regulamin dotyczy korzystania z aplikacji WizytaOK w modelu usługi cyfrowej (SaaS).",
  "Przed komercyjnym uruchomieniem dokument wymaga uzupełnienia danych Operatora oraz finalnej weryfikacji prawnej.",
]

export const TERMS_SECTIONS: Array<{ title: string; paragraphs: string[] }> = [
  {
    title: "1. Informacje wstępne",
    paragraphs: [
      "Regulamin określa zasady świadczenia usług drogą elektroniczną w ramach WizytaOK, prawa i obowiązki stron oraz podstawowe zasady odpowiedzialności.",
      "Regulamin należy interpretować z uwzględnieniem obowiązujących przepisów prawa, w szczególności przepisów o świadczeniu usług drogą elektroniczną, prawach konsumenta, usługach cyfrowych i ochronie danych osobowych (RODO).",
    ],
  },
  {
    title: "2. Definicje",
    paragraphs: [
      "WizytaOK - aplikacja SaaS do zarządzania rezerwacjami online, wizytami, zespołem, grafikiem, klientami i komunikacją.",
      `Operator - podmiot udostępniający WizytaOK. ${LEGAL_BETA_OPERATOR_PUBLIC_NOTICE}`,
      "Użytkownik - osoba korzystająca z konta w WizytaOK w imieniu własnym lub Firmy/Organizacji.",
      "Firma / Organizacja - podmiot korzystający z WizytaOK do obsługi swojej działalności usługowej.",
      "Klient końcowy - osoba dokonująca rezerwacji usługi u Firmy/Organizacji przez formularz online lub inny kanał obsługiwany przez WizytaOK.",
      "Konto - indywidualny dostęp Użytkownika do Panelu.",
      "Usługa - świadczenie oferowane przez Firmę/Organizację i konfigurowane w WizytaOK.",
      "Rezerwacja - zapis terminu usługi dokonany przez Klienta końcowego lub Użytkownika.",
      "Panel - część administracyjna WizytaOK dostępna po zalogowaniu.",
      "Abonament - cykliczna opłata za korzystanie z WizytaOK, jeśli i gdy zostanie uruchomiona komercyjnie.",
      "Okres próbny - czas testowego korzystania z WizytaOK na zasadach wskazanych w aplikacji.",
    ],
  },
  {
    title: "3. Status projektu i dane Operatora",
    paragraphs: [
      "WizytaOK znajduje się w wersji testowej/Beta i przed sprzedażą komercyjną wymaga formalnego uzupełnienia danych Operatora oraz warunków handlowych.",
      "Miejsca oznaczone placeholderami muszą zostać uzupełnione przed rozpoczęciem odpłatnego świadczenia usługi.",
    ],
  },
  {
    title: "4. Zakres działania WizytaOK",
    paragraphs: [
      "WizytaOK umożliwia m.in.: obsługę rezerwacji online, panel wizyt, zarządzanie klientami, grafikiem i dostępnością, zarządzanie zespołem oraz konfigurację wiadomości SMS/e-mail.",
      "W aplikacji mogą być dostępne także narzędzia wsparcia, statystyki i raporty w zakresie aktualnie wdrożonych funkcji.",
    ],
  },
  {
    title: "5. Warunki korzystania z aplikacji",
    paragraphs: [
      "Do korzystania z WizytaOK wymagane są: urządzenie z dostępem do Internetu, aktualna przeglądarka oraz aktywny adres e-mail.",
      "Użytkownik zobowiązuje się korzystać z aplikacji zgodnie z jej przeznaczeniem, Regulaminem i przepisami prawa.",
    ],
  },
  {
    title: "6. Zakładanie konta i odpowiedzialność za konto",
    paragraphs: [
      "Założenie konta wymaga podania prawdziwych danych i ustawienia bezpiecznego hasła.",
      "Użytkownik odpowiada za bezpieczeństwo danych logowania oraz działania wykonane po zalogowaniu.",
      "W razie podejrzenia nieuprawnionego dostępu Użytkownik powinien niezwłocznie zmienić hasło i skontaktować się z supportem.",
    ],
  },
  {
    title: "7. Obowiązki Użytkownika",
    paragraphs: [
      "Użytkownik odpowiada za poprawność danych usług, cenników, grafików, zespołu, danych kontaktowych oraz treści wysyłanych do Klientów końcowych.",
      "Użytkownik nie może używać WizytaOK do działań naruszających prawo, prawa osób trzecich lub dobre obyczaje.",
    ],
  },
  {
    title: "8. Publiczny formularz rezerwacji",
    paragraphs: [
      "Firma/Organizacja może udostępniać Klientom końcowym publiczny formularz rezerwacji.",
      "Firma/Organizacja odpowiada za to, jakie usługi i terminy są udostępniane oraz za informacje prezentowane Klientom końcowym.",
    ],
  },
  {
    title: "9. Wizyty, anulowanie i statusy",
    paragraphs: [
      "WizytaOK prezentuje statusy wizyt i ułatwia obsługę potwierdzeń, zmian i anulowań.",
      "Statusy systemowe mają charakter informacyjny i nie zastępują wewnętrznych zasad obsługi klienta po stronie Firmy/Organizacji.",
    ],
  },
  {
    title: "10. Wiadomości SMS/e-mail",
    paragraphs: [
      "WizytaOK może wysyłać przypomnienia i komunikaty związane z wizytami.",
      "Rzeczywista wysyłka i doręczenie zależą od konfiguracji oraz działania zewnętrznych dostawców SMS/e-mail.",
      "Firma/Organizacja odpowiada za legalność i zgodność komunikacji z Klientami końcowymi, w tym za podstawę prawną kontaktu.",
    ],
  },
  {
    title: "11. Dostępność usługi",
    paragraphs: [
      "Operator dokłada starań, aby usługa działała stabilnie, jednak nie gwarantuje nieprzerwanej dostępności.",
      "Mogą wystąpić przerwy techniczne, aktualizacje, awarie infrastruktury lub awarie dostawców zewnętrznych.",
    ],
  },
  {
    title: "12. Płatności i abonament",
    paragraphs: [
      "Warunki płatności i abonamentu zostaną doprecyzowane przed komercyjnym startem usługi.",
      "Szczegóły cen i warunków komercyjnych zostaną opublikowane przed uruchomieniem płatnej wersji usługi.",
    ],
  },
  {
    title: "13. Prawo odstąpienia / konsumenci",
    paragraphs: [
      "Jeżeli usługa będzie oferowana konsumentom, prawa konsumenta będą realizowane zgodnie z obowiązującymi przepisami, w tym przepisami o usługach cyfrowych.",
      "Przed startem komercyjnym należy uzupełnić i zweryfikować szczegółowe zasady dotyczące odstąpienia od umowy oraz wyjątków ustawowych.",
    ],
  },
  {
    title: "14. Reklamacje",
    paragraphs: [
      "Reklamacje dotyczące działania WizytaOK w okresie testowym można zgłaszać poprzez formularz kontaktu udostępniony w aplikacji. Po uruchomieniu komercyjnym zostanie podany dedykowany kanał kontaktu z Operatorem.",
      "Opis zgłoszenia powinien zawierać co najmniej dane kontaktowe zgłaszającego, opis problemu i oczekiwany sposób rozwiązania.",
      "Operator udziela odpowiedzi w rozsądnym terminie, nie dłuższym niż wymagany przez przepisy prawa.",
    ],
  },
  {
    title: "15. Odpowiedzialność",
    paragraphs: [
      "WizytaOK jest narzędziem SaaS wspierającym organizację pracy i komunikację, a nie stroną relacji usługowej pomiędzy Firmą/Organizacją a Klientem końcowym.",
      "Firma/Organizacja odpowiada za sposób wykonywania własnych usług, poprawność danych i zgodność działań z prawem.",
      "Operator nie odpowiada za szkody wynikające z błędnych danych lub konfiguracji po stronie Użytkownika, chyba że bezwzględnie obowiązujące przepisy stanowią inaczej.",
    ],
  },
  {
    title: "16. Usunięcie konta / zakończenie korzystania",
    paragraphs: [
      "Użytkownik może zakończyć korzystanie z WizytaOK i złożyć wniosek o usunięcie konta.",
      "Szczegółowe zasady retencji i usuwania danych opisuje Polityka prywatności oraz obowiązujące przepisy.",
    ],
  },
  {
    title: "17. Własność intelektualna",
    paragraphs: [
      "Prawa do WizytaOK, jego kodu, interfejsu, znaków i materiałów należą do Operatora lub uprawnionych podmiotów.",
      "Korzystanie z usługi nie oznacza przeniesienia praw własności intelektualnej na Użytkownika.",
    ],
  },
  {
    title: "18. Zmiany Regulaminu",
    paragraphs: [
      "Operator może zmienić Regulamin z ważnych przyczyn, w szczególności zmian prawa, zakresu usługi lub wymogów bezpieczeństwa.",
      "Nowa wersja Regulaminu będzie publikowana w aplikacji wraz z informacją o dacie wejścia w życie — po zakończeniu okresu testowego i przed pełnym uruchomieniem komercyjnym zostanie to doprecyzowane.",
    ],
  },
  {
    title: "19. Kontakt",
    paragraphs: [
      `Kontakt z Operatorem w okresie testowym: poprzez formularz kontaktu w aplikacji. ${LEGAL_BETA_OPERATOR_PUBLIC_NOTICE}`,
    ],
  },
  {
    title: "20. Postanowienia końcowe",
    paragraphs: [
      "W sprawach nieuregulowanych Regulaminem stosuje się przepisy prawa polskiego oraz bezwzględnie obowiązujące przepisy prawa konsumenckiego i ochrony danych.",
      "Regulamin w wersji roboczej obowiązuje na czas publicznego testu WizytaOK do czasu publikacji wersji finalnej.",
    ],
  },
]
