import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_OPERATOR,
  legalOperatorBlock,
} from "@/content/legal/operator"

export const TERMS_INTRO = [
  `Niniejszy Regulamin określa zasady korzystania z platformy ${LEGAL_OPERATOR.serviceName} (${LEGAL_OPERATOR.serviceUrl}) świadczonej drogą elektroniczną przez ${LEGAL_OPERATOR.operatorName}.`,
  "Regulamin stanowi umowę o świadczenie usług cyfrowych w rozumieniu ustawy o prawach konsumenta oraz przepisów o świadczeniu usług drogą elektroniczną, w zakresie w jakim ma zastosowanie do danej relacji (B2B lub B2C).",
  "Akceptacja Regulaminu następuje przez założenie konta, rozpoczęcie okresu próbnego lub korzystanie z platformy.",
]

export const TERMS_SECTIONS: Array<{ title: string; paragraphs: string[] }> = [
  {
    title: "1. Postanowienia ogólne",
    paragraphs: [
      `Regulamin określa prawa i obowiązki ${LEGAL_OPERATOR.operatorName} (dalej: „Operator”) oraz Użytkowników platformy ${LEGAL_OPERATOR.serviceName} (dalej: „Platforma”).`,
      "W sprawach nieuregulowanych stosuje się prawo polskie oraz bezwzględnie obowiązujące przepisy Unii Europejskiej, w tym o usługach cyfrowych i ochronie danych osobowych.",
      `Kontakt z Operatorem: ${LEGAL_OPERATOR.contactEmail}, ${LEGAL_OPERATOR.serviceUrl}.`,
    ],
  },
  {
    title: "2. Definicje",
    paragraphs: [
      `Platforma / ${LEGAL_OPERATOR.serviceName} — aplikacja SaaS dostępna pod adresem ${LEGAL_OPERATOR.serviceUrl}.`,
      `Operator — ${legalOperatorBlock()}.`,
      "Użytkownik — osoba fizyczna posiadająca konto w Platformie, działająca w imieniu własnym lub Firmy/Organizacji.",
      "Firma / Organizacja — podmiot korzystający z Platformy do obsługi rezerwacji, wizyt, zespołu i klientów.",
      "Klient końcowy — osoba dokonująca rezerwacji u Firmy/Organizacji przez publiczną stronę rezerwacji lub inny kanał obsługiwany w Platformie.",
      "Konto — indywidualny dostęp Użytkownika do panelu administracyjnego.",
      "Panel — część Platformy dostępna po zalogowaniu.",
      "Usługa (w rozumieniu biznesowym) — usługa oferowana przez Firmę/Organizację Klientom końcowym, skonfigurowana w Platformie.",
      "Rezerwacja / wizyta — zapis terminu w systemie.",
      "Abonament — płatny dostęp do Platformy w modelu subskrypcyjnym (jeśli aktywny).",
      "Okres próbny — bezpłatny lub promocyjny okres testowy Platformy na zasadach wskazanych w aplikacji.",
    ],
  },
  {
    title: "3. Zakres świadczenia usługi",
    paragraphs: [
      "Operator świadczy usługę polegającą na udostępnieniu Platformy umożliwiającej m.in.:",
      "— publiczną rezerwację online,",
      "— panel wizyt i kalendarz wewnętrzny,",
      "— bazę klientów,",
      "— zarządzanie zespołem, grafikiem i wyjątkami dostępności,",
      "— konfigurację wiadomości SMS/e-mail i przypomnień,",
      "— statystyki i eksporty,",
      "— integrację z Google Calendar (po dobrowolnym połączeniu),",
      "— program poleceń,",
      "— obsługę abonamentu i płatności online (Stripe),",
      "— wsparcie techniczne w zakresie opisanym w aplikacji.",
      "Operator może rozwijać, modyfikować lub wycofywać funkcje, z zachowaniem rozsądnego okresu na adaptację, o ile nie narusza to istoty opłaconej usługi.",
    ],
  },
  {
    title: "4. Warunki techniczne",
    paragraphs: [
      "Do korzystania wymagane są: urządzenie z dostępem do Internetu, aktualna przeglądarka internetowa oraz aktywny adres e-mail.",
      "Użytkownik odpowiada za zapewnienie własnego bezpiecznego połączenia z Internetem i aktualnego oprogramowania.",
    ],
  },
  {
    title: "5. Rejestracja konta",
    paragraphs: [
      "Założenie Konta wymaga podania prawdziwych danych oraz akceptacji Regulaminu i Polityki prywatności.",
      "Użytkownik może rejestrować się adresem e-mail i hasłem lub — jeśli dostępne — przez logowanie Google/Facebook.",
      "Użytkownik zobowiązuje się do zachowania poufności danych logowania. Działania wykonane po zalogowaniu uważa się za dokonane przez Użytkownika, o ile nie udowodni on nieuprawnionego dostępu.",
      "W razie podejrzenia naruszenia bezpieczeństwa Konta Użytkownik powinien niezwłocznie zmienić hasło i poinformować Operatora.",
    ],
  },
  {
    title: "6. Okres próbny i abonament",
    paragraphs: [
      "Operator może udostępnić Okres próbny na zasadach wskazanych w Platformie (czas trwania, limit funkcji).",
      "Po Okresie próbnym korzystanie z pełnej funkcjonalności może wymagać wykupienia Abonamentu.",
      "Ceny, plany, cykle rozliczeniowe i metody płatności są prezentowane w Platformie przed złożeniem zamówienia.",
      "Płatności abonamentu obsługuje Stripe; Operator nie przechowuje pełnych danych karty płatniczej.",
      "Brak opłaty w terminie może skutkować ograniczeniem dostępu do Platformy po upływie okresu wynikającego z przepisów lub umowy.",
      "Szczegółowe warunki odstąpienia od umowy zawiera sekcja 16.",
    ],
  },
  {
    title: "7. Obowiązki Użytkownika",
    paragraphs: [
      "Użytkownik korzysta z Platformy zgodnie z Regulaminem, prawem i dobrymi obyczajami.",
      "Użytkownik odpowiada za poprawność danych Firmy/Organizacji, usług, cenników, grafików, zespołu, szablonów wiadomości oraz treści kierowanych do Klientów końcowych.",
      "Zabronione jest korzystanie z Platformy w sposób naruszający prawa osób trzecich, w tym prawa autorskie, dane osobowe, przepisy telekomunikacyjne i antyspamowe.",
      "Użytkownik nie może podejmować prób obejścia zabezpieczeń, reverse engineeringu, nadmiernego obciążania infrastruktury ani udostępniania Konta osobom nieuprawnionym.",
    ],
  },
  {
    title: "8. Publiczna strona rezerwacji",
    paragraphs: [
      "Firma/Organizacja może udostępnić Klientom końcowym publiczną stronę rezerwacji pod unikalnym adresem.",
      "Firma/Organizacja odpowiada za treści, ceny, dostępność terminów i informacje prawne wymagane wobec Klientów końcowych (np. regulamin salonu, polityka odwołania wizyty).",
      "Operator nie jest stroną umowy o świadczenie usługi między Firmą/Organizacją a Klientem końcowym.",
    ],
  },
  {
    title: "9. Wizyty, statusy i anulowanie",
    paragraphs: [
      "Platforma rejestruje wizyty, statusy (np. oczekująca, potwierdzona, anulowana, zakończona, nieobecność) oraz historię zmian w zakresie funkcji systemu.",
      "Statusy mają charakter operacyjny i informacyjny; odpowiedzialność za faktyczną obsługę Klienta końcowego spoczywa na Firmie/Organizacji.",
      "Mechanizmy potwierdzania, zmiany terminu lub anulowania przez Klienta końcowego działają zgodnie z konfiguracją Firmy/Organizacji.",
    ],
  },
  {
    title: "10. Wiadomości SMS i e-mail",
    paragraphs: [
      "Platforma umożliwia wysyłkę wiadomości transakcyjnych (potwierdzenia, przypomnienia, anulowania) przez skonfigurowanych dostawców.",
      "Firma/Organizacja odpowiada za legalność wysyłki, w tym posiadanie odpowiedniej podstawy prawnej kontaktu z Klientem końcowym (umowa, prawnie uzasadniony interes, zgoda — w zależności od przypadku).",
      "Operator nie gwarantuje doręczenia każdej wiadomości; na skuteczność wpływają m.in. operatorzy telekomunikacyjni, filtry antyspamowe i poprawność numeru/adresu.",
      "Koszty wiadomości SMS (jeśli dotyczy) mogą być rozliczane zgodnie z planem abonamentu lub cennikiem Operatora.",
    ],
  },
  {
    title: "11. Integracja Google Calendar",
    paragraphs: [
      "Użytkownik może dobrowolnie połączyć konto Google w celu synchronizacji wizyt z wybranym kalendarzem.",
      "Synchronizacja obejmuje tworzenie, aktualizację i oznaczanie anulowanych wydarzeń powiązanych z wizytami w Platformie.",
      "Operator nie odpowiada za działanie API Google, limity OAuth ani zmiany po stronie Google.",
      "Użytkownik może w każdej chwili rozłączyć integrację w ustawieniach Platformy.",
    ],
  },
  {
    title: "12. Zespół, role i uprawnienia",
    paragraphs: [
      "Użytkownik z uprawnieniami administratora może zapraszać członków zespołu i nadawać im role.",
      "Administrator odpowiada za nadawanie uprawnień zgodnie z zasadą minimalnego dostępu.",
      "Operator może zawiesić Konto w razie naruszenia Regulaminu lub podejrzenia nadużycia.",
    ],
  },
  {
    title: "13. Dostępność usługi",
    paragraphs: [
      "Operator dokłada starań, aby Platforma działała stabilnie, lecz nie gwarantuje nieprzerwanego działania.",
      "Dopuszczalne są przerwy techniczne, konserwacja, aktualizacje oraz awarie infrastruktury lub dostawców zewnętrznych.",
      "Operator informuje o planowanych przerwach w miarę możliwości z wyprzedzeniem.",
    ],
  },
  {
    title: "14. Własność intelektualna",
    paragraphs: [
      "Prawa autorskie, prawa do baz danych, znaki towarowe, kod, interfejs i materiały Platformy należą do Operatora lub jego licencjodawców.",
      "Korzystanie z Platformy nie oznacza nabycia jakichkolwiek praw własności intelektualnej poza niewyłączną licencją użytkowania w trakcie trwania umowy.",
      "Treści wprowadzane przez Użytkownika pozostają jego własnością; Użytkownik udziela Operatorowi niewyłącznej licencji na przetwarzanie ich wyłącznie w celu świadczenia usługi.",
    ],
  },
  {
    title: "15. Ochrona danych osobowych",
    paragraphs: [
      "Zasady przetwarzania danych osobowych określa Polityka prywatności dostępna pod adresem: " + LEGAL_OPERATOR.serviceUrl + "/privacy.",
      "Firma/Organizacja jako administrator danych Klientów końcowych odpowiada za legalność ich pozyskania i wykorzystania.",
    ],
  },
  {
    title: "16. Prawo odstąpienia od umowy",
    paragraphs: [
      "Jeżeli Użytkownikiem jest konsument, przysługuje mu prawo odstąpienia od umowy zawartej na odległość w terminie 14 dni, z wyjątkami przewidzianymi prawem.",
      "W przypadku usługi cyfrowej rozpoczętej za wyraźną zgodą konsumenta przed upływem terminu odstąpienia — po poinformowaniu o utracie prawa odstąpienia — prawo to może wygasnąć zgodnie z art. 38 ustawy o prawach konsumenta.",
      "Oświadczenie o odstąpieniu należy wysłać na adres: " + LEGAL_OPERATOR.contactEmail + ".",
      "W relacjach B2B (przedsiębiorca profesjonalny) prawo odstąpienia co do zasady nie ma zastosowania, o ile strony nie postanowią inaczej.",
    ],
  },
  {
    title: "17. Reklamacje",
    paragraphs: [
      "Reklamacje dotyczące działania Platformy można zgłaszać na adres: " + LEGAL_OPERATOR.contactEmail + " lub przez formularz kontaktu w aplikacji.",
      "Reklamacja powinna zawierać: dane kontaktowe, opis problemu, datę wystąpienia i oczekiwany sposób rozpatrzenia.",
      "Operator udziela odpowiedzi w terminie 14 dni od otrzymania reklamacji; w sprawach skomplikowanych termin może zostać wydłużony do 30 dni z podaniem przyczyny.",
    ],
  },
  {
    title: "18. Odpowiedzialność Operatora",
    paragraphs: [
      "Platforma jest narzędziem wspierającym organizację pracy Firmy/Organizacji, a nie stroną relacji usługowej z Klientem końcowym.",
      "Operator nie odpowiada za szkody wynikłe z błędnej konfiguracji, treści wprowadzonych przez Użytkownika, decyzji biznesowych Firmy/Organizacji ani za utracone korzyści.",
      "Odpowiedzialność Operatora wobec Użytkownika będącego przedsiębiorcą ograniczona jest do wysokości opłat uiszczonych za Abonament w okresie 12 miesięcy poprzedzających zdarzenie, chyba że bezwzględnie obowiązujące przepisy stanowią inaczej.",
      "Ograniczenia nie dotyczą szkody wyrządzonej umyślnie oraz sytuacji, w których wyłączenie odpowiedzialności jest niedopuszczalne.",
    ],
  },
  {
    title: "19. Rozwiązanie umowy i usunięcie konta",
    paragraphs: [
      "Użytkownik może w każdej chwili zaprzestać korzystania z Platformy i złożyć wniosek o usunięcie Konta.",
      "Operator może wypowiedzieć umowę ze skutkiem natychmiastowym w razie rażącego naruszenia Regulaminu, opóźnienia w płatnościach lub zagrożenia bezpieczeństwa.",
      "Po zakończeniu umowy dane są przechowywane i usuwane zgodnie z Polityką prywatności; Firma/Organizacja powinna wcześniej pobrać dane, które chce zachować.",
    ],
  },
  {
    title: "20. Zmiany Regulaminu",
    paragraphs: [
      "Operator może zmienić Regulamin z ważnych przyczyn: zmiana prawa, rozwój Platformy, zmiana modelu biznesowego, wymogi bezpieczeństwa.",
      "O zmianach poinformujemy z co najmniej 14-dniowym wyprzedzeniem e-mailem lub komunikatem w Panelu, o ile zmiana nie jest korzystna wyłącznie dla Operatora w stopniu wymagającym natychmiastowej obowiązywania.",
      "Dalsze korzystanie po dacie wejścia zmian w życie oznacza akceptację nowego Regulaminu; w razie braku akceptacji Użytkownik powinien zaprzestać korzystania i usunąć Konto.",
      `Aktualna wersja obowiązuje od ${LEGAL_EFFECTIVE_DATE}.`,
    ],
  },
  {
    title: "21. Postanowienia końcowe",
    paragraphs: [
      "Nieważność któregokolwiek postanowienia Regulaminu nie wpływa na ważność pozostałych.",
      "Spory z Użytkownikiem będącym konsumentem rozstrzygają sądy powszechne właściwe według przepisów; Użytkownik może skorzystać z pozasądowych sposobów rozpatrywania reklamacji i dochodzenia roszczeń (m.in. platforma ODR: https://ec.europa.eu/consumers/odr).",
      "W relacjach B2B właściwym sądem miejscowo właściwym dla siedziby Operatora jest sąd właściwy miejscowo dla Operatora, o ile przepisy na to pozwalają.",
      `Regulamin obowiązuje od ${LEGAL_EFFECTIVE_DATE}.`,
    ],
  },
]
