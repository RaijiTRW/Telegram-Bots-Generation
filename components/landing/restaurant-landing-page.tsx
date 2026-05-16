import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  Clock3,
  MessageCircle,
  ReceiptText,
  Utensils,
} from "lucide-react";
import { LandingPricingSection } from "@/components/billing/landing-pricing-section";
import { RestaurantLandingKinetics } from "@/components/landing/restaurant-landing-kinetics";
import {
  RestaurantCtaMotion,
  RestaurantInteractiveCard,
  RestaurantReveal,
} from "@/components/landing/restaurant-motion";
import { RestaurantThreeBackground } from "@/components/landing/restaurant-three-background";
import type { Locale } from "@/app/i18n";
import { PUBLIC_SITE } from "@/lib/site/public-config";

type RestaurantLandingCopy = {
  hero: {
    title: string;
    body: string;
    primary: string;
    secondary: string;
    phoneTitle: string;
    phoneStatus: string;
    guestMessage: string;
    botMessage: string;
    action: string;
  };
  sections: {
    operationsTitle: string;
    operationsBody: string;
    scenariosTitle: string;
    scenariosBody: string;
    workflowTitle: string;
    workflowBody: string;
    crmTitle: string;
    crmBody: string;
    finalTitle: string;
    finalBody: string;
  };
  operations: Array<{ title: string; body: string; stat: string }>;
  scenarios: Array<{ title: string; body: string; note: string }>;
  workflow: Array<{ title: string; body: string }>;
  crmCards: Array<{ title: string; meta: string; stage: string; value: string }>;
  finalPrimary: string;
  finalSecondary: string;
};

const copy: Record<Locale, RestaurantLandingCopy> = {
  ru: {
    hero: {
      title: "Telegram-бот для ресторана, который сразу работает в зале",
      body: "Меню, бронь, доставка, акции и заявки собираются в один Telegram-сценарий. Гости пишут как привыкли, а ресторан получает понятные карточки в CRM.",
      primary: "Создать бота для ресторана",
      secondary: "Посмотреть сценарии",
      phoneTitle: "Bistro Lumi",
      phoneStatus: "онлайн",
      guestMessage: "Хочу столик сегодня на 20:00",
      botMessage: "Отлично. На сколько гостей забронировать стол и как вас записать?",
      action: "Забронировать",
    },
    sections: {
      operationsTitle: "Это не чат-бот ради чат-бота. Это рабочий контур ресторана.",
      operationsBody: "CBTooll переводит разговор с гостем в действия: показать меню, принять бронь, оформить заказ, создать заявку и передать её менеджеру.",
      scenariosTitle: "Сценарии под реальные ресторанные задачи",
      scenariosBody: "Шаблон уже содержит основу логики. Вы меняете меню, условия, адрес, часы работы и CRM-поля под свой ресторан.",
      workflowTitle: "Запуск без тяжелого проекта",
      workflowBody: "Сначала выбираете направление, затем добавляете данные ресторана, тестируете путь гостя и запускаете Telegram-бота.",
      crmTitle: "Брони, заказы и заявки не теряются в переписке",
      crmBody: "Каждый результат становится карточкой: с этапом, телефоном, временем, суммой, комментарием и источником.",
      finalTitle: "Соберите Telegram-оператора ресторана за вечер",
      finalBody: "Начните с готового ресторанного сценария или пустого проекта, если хотите собрать свою логику с нуля.",
    },
    operations: [
      { title: "Гость пишет в Telegram", body: "Без приложения, регистрации и формы на сайте. Диалог начинается там, где гостю удобно.", stat: "01" },
      { title: "Бот собирает данные", body: "Меню, дата, время, гости, телефон, адрес, комментарий и другие поля сценария.", stat: "02" },
      { title: "CRM принимает результат", body: "Бронь, заказ или заявка появляются как карточка в нужном этапе воронки.", stat: "03" },
    ],
    scenarios: [
      { title: "Меню", body: "Категории, блюда, цены, состав и рекомендации без PDF-переписок.", note: "выбор блюда" },
      { title: "Бронирование", body: "Дата, время, гости, имя, телефон и подтверждение для администратора.", note: "столик" },
      { title: "Доставка и самовывоз", body: "Заказ, адрес или самовывоз, телефон, комментарий и итоговая сумма.", note: "заказ" },
      { title: "Акции и FAQ", body: "Часы работы, адрес, парковка, скидки, условия и ответы на частые вопросы.", note: "поддержка" },
      { title: "Заявка менеджеру", body: "Контакт, запрос, источник и нужные поля сразу уходят в CRM.", note: "лид" },
    ],
    workflow: [
      { title: "Выберите сценарий", body: "Меню, бронь, доставка, FAQ, заявка или пустой проект для своей логики." },
      { title: "Внесите данные", body: "Добавьте блюда, цены, адрес, правила брони и ответы, которые должен знать бот." },
      { title: "Проверьте в Telegram preview", body: "Пройдите путь гостя прямо в редакторе до запуска в реальный Telegram." },
      { title: "Ведите заявки в CRM", body: "Карточки появляются в воронке и двигаются по этапам работы ресторана." },
    ],
    crmCards: [
      { title: "Бронь на сегодня", meta: "Алексей · 20:00 · 4 гостя", stage: "Новая", value: "стол 7" },
      { title: "Самовывоз", meta: "Марина · паста, салат, десерт", stage: "В работе", value: "3 450 ₽" },
      { title: "Банкетный запрос", meta: "Компания · 18 гостей · пятница", stage: "Ожидает", value: "менеджер" },
    ],
    finalPrimary: "Создать ресторанного бота",
    finalSecondary: "Открыть тарифы",
  },
  en: {
    hero: {
      title: "A Telegram bot for restaurants that works on the floor",
      body: "Menu, reservations, delivery, offers, and requests become one Telegram flow. Guests write naturally, while the restaurant receives structured CRM cards.",
      primary: "Create restaurant bot",
      secondary: "Explore scenarios",
      phoneTitle: "Bistro Lumi",
      phoneStatus: "online",
      guestMessage: "I need a table today at 8 PM",
      botMessage: "Perfect. How many guests should I book for, and what name should I use?",
      action: "Book table",
    },
    sections: {
      operationsTitle: "Not a chatbot for the sake of chat. A working restaurant operation loop.",
      operationsBody: "CBTooll turns a guest conversation into actions: show a menu, accept a reservation, collect an order, create a request, and hand it to the team.",
      scenariosTitle: "Scenarios for real restaurant work",
      scenariosBody: "The template already contains the flow. You add menu items, rules, address, opening hours, and CRM fields for your restaurant.",
      workflowTitle: "Launch without a heavy project",
      workflowBody: "Choose a direction, add restaurant data, test the guest path, and launch the Telegram bot.",
      crmTitle: "Reservations, orders, and requests do not disappear in chat",
      crmBody: "Every result becomes a card with stage, phone, time, amount, comment, and source.",
      finalTitle: "Build a Telegram operator for your restaurant in one evening",
      finalBody: "Start with a ready restaurant scenario or an empty project if you want custom logic from scratch.",
    },
    operations: [
      { title: "Guest writes in Telegram", body: "No app download, registration, or website form. The conversation starts where the guest already is.", stat: "01" },
      { title: "The bot collects data", body: "Menu, date, time, guests, phone, address, comments, and any scenario fields.", stat: "02" },
      { title: "CRM receives the result", body: "Reservation, order, or request appears as a card in the right pipeline stage.", stat: "03" },
    ],
    scenarios: [
      { title: "Menu", body: "Categories, dishes, prices, ingredients, and recommendations without PDF back-and-forth.", note: "selection" },
      { title: "Reservation", body: "Date, time, guests, name, phone, and confirmation for the host.", note: "table" },
      { title: "Delivery and pickup", body: "Order, address or pickup, phone, comment, and final amount.", note: "order" },
      { title: "Offers and FAQ", body: "Hours, address, parking, discounts, policies, and frequent answers.", note: "support" },
      { title: "Manager request", body: "Contact, request, source, and custom fields go straight into CRM.", note: "lead" },
    ],
    workflow: [
      { title: "Choose a scenario", body: "Menu, reservation, delivery, FAQ, request, or an empty project for your own logic." },
      { title: "Add restaurant data", body: "Dishes, prices, address, reservation rules, and answers the bot should know." },
      { title: "Test in Telegram preview", body: "Go through the guest path inside the editor before launching in Telegram." },
      { title: "Manage requests in CRM", body: "Cards appear in the pipeline and move through restaurant operation stages." },
    ],
    crmCards: [
      { title: "Tonight reservation", meta: "Alex · 8 PM · 4 guests", stage: "New", value: "table 7" },
      { title: "Pickup order", meta: "Marina · pasta, salad, dessert", stage: "In progress", value: "$38" },
      { title: "Private event", meta: "Company · 18 guests · Friday", stage: "Waiting", value: "manager" },
    ],
    finalPrimary: "Create restaurant bot",
    finalSecondary: "Open pricing",
  },
};

const scenarioIcons = [Utensils, CalendarDays, ReceiptText, MessageCircle, ClipboardList];

function SectionHeader({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-4xl">
      <h2 className="text-4xl font-semibold leading-[0.98] tracking-[-0.055em] text-white md:text-6xl">
        {title}
      </h2>
      <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-400 md:text-lg">{body}</p>
    </div>
  );
}

function CrmBoard({ cards }: { cards: RestaurantLandingCopy["crmCards"] }) {
  const stages = cards.map((card) => card.stage);

  return (
    <div className="rounded-[34px] border border-white/10 bg-[#08090C] p-4 shadow-[0_45px_140px_rgba(0,0,0,0.54)]">
      <div className="grid min-w-[760px] grid-cols-3 gap-4">
        {stages.map((stage, index) => {
          const stageCards = cards[index] ? [cards[index]] : [];

          return (
          <div key={stage} className="min-h-[430px] rounded-[26px] border border-white/10 bg-white/[0.028] p-4">
            <div className="mb-5 flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: index === 0 ? "#36D6B7" : index === 1 ? "#E9C46A" : "#8B8FA3" }}
                />
                {stage}
              </div>
              <span className="text-xs text-zinc-500">{stageCards.length}</span>
            </div>
            <div className="space-y-3">
              {stageCards.map((card) => (
                <div key={`${stage}-${card.title}`} className="rounded-2xl border border-white/10 bg-[#0D1016] p-4">
                  <div className="text-base font-semibold text-white">{card.title}</div>
                  <div className="mt-2 text-sm leading-6 text-zinc-500">{card.meta}</div>
                  <div className="mt-5 flex items-center justify-between text-sm">
                    <span className="text-[#36D6B7]">telegram</span>
                    <span className="text-zinc-400">{card.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

export function RestaurantLandingPage({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const signupHref = PUBLIC_SITE.primaryConversionPath(locale);
  const pricingHref = PUBLIC_SITE.pricingPath(locale);

  return (
    <div className="relative isolate overflow-hidden bg-[#050506] text-white">
      <RestaurantLandingKinetics />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_4%,rgba(33,44,48,0.92),transparent_34%),linear-gradient(180deg,#050607_0%,#040404_58%,#020203_100%)]" />

      <section className="relative z-10 min-h-[calc(100svh-6rem)] overflow-hidden px-5 py-16 md:px-8 md:py-24">
        <RestaurantThreeBackground />
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,rgba(5,5,6,0.88)_0%,rgba(5,5,6,0.74)_38%,rgba(5,5,6,0.24)_68%,#050506_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-44 bg-gradient-to-b from-transparent to-[#050506]" />
        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-14rem)] max-w-5xl flex-col items-center justify-center text-center">
          <h1 className="mx-auto max-w-5xl text-[2.7rem] font-semibold leading-[0.96] tracking-[-0.055em] text-white sm:text-[3.85rem] md:text-[4.35rem] lg:text-[4.85rem] xl:text-[5.2rem]">
            {t.hero.title}
          </h1>
          <p className="mx-auto mt-7 max-w-3xl text-base leading-8 text-zinc-300 md:text-xl md:leading-9">
            {t.hero.body}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <RestaurantCtaMotion>
              <Link
                href={signupHref}
                className="group inline-flex items-center justify-center gap-4 rounded-full bg-white py-2 pl-7 pr-2 text-base font-semibold text-[#08090C] shadow-[0_28px_90px_rgba(255,255,255,0.12)] transition hover:bg-[#E9C46A]"
              >
                {t.hero.primary}
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/10 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5">
                  <ArrowRight className="h-5 w-5" />
                </span>
              </Link>
            </RestaurantCtaMotion>
            <RestaurantCtaMotion delay={0.06}>
              <Link
                href="#scenarios"
                className="inline-flex items-center justify-center rounded-full border border-white/14 bg-black/35 px-7 py-4 text-base font-semibold text-white backdrop-blur transition hover:bg-white/[0.08]"
              >
                {t.hero.secondary}
              </Link>
            </RestaurantCtaMotion>
          </div>
        </div>
      </section>

      <section id="features" className="relative z-10 border-y border-white/[0.08] bg-[#050506]/80 px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-[1500px]">
          <RestaurantReveal>
            <SectionHeader title={t.sections.operationsTitle} body={t.sections.operationsBody} />
          </RestaurantReveal>
          <div className="mt-14 grid gap-px overflow-hidden rounded-[34px] border border-white/10 bg-white/10 lg:grid-cols-3">
            {t.operations.map((item, index) => (
              <RestaurantInteractiveCard key={item.title} delay={index * 0.08}>
                <article className="min-h-[340px] bg-[#07080A] p-8 md:p-10">
                  <div className="mb-20 flex items-center justify-between">
                    <span className="font-mono text-sm text-[#E9C46A]">{item.stat}</span>
                    {index === 0 ? <MessageCircle className="h-6 w-6 text-zinc-500" /> : index === 1 ? <Clock3 className="h-6 w-6 text-zinc-500" /> : <ClipboardList className="h-6 w-6 text-zinc-500" />}
                  </div>
                  <h3 className="max-w-sm text-3xl font-semibold leading-tight tracking-[-0.045em] text-white">{item.title}</h3>
                  <p className="mt-5 max-w-sm text-base leading-8 text-zinc-400">{item.body}</p>
                </article>
              </RestaurantInteractiveCard>
            ))}
          </div>
        </div>
      </section>

      <section id="scenarios" className="relative z-10 px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto grid max-w-[1500px] gap-12 lg:grid-cols-[0.7fr_1.3fr]">
          <RestaurantReveal>
            <div className="sticky top-28">
              <SectionHeader title={t.sections.scenariosTitle} body={t.sections.scenariosBody} />
            </div>
          </RestaurantReveal>
          <div className="grid gap-4 md:grid-cols-2" data-kinetic="soft">
            {t.scenarios.map((scenario, index) => {
              const Icon = scenarioIcons[index] || MessageCircle;
              return (
                <RestaurantInteractiveCard key={scenario.title} delay={index * 0.06}>
                  <article className="group min-h-[300px] rounded-[32px] border border-white/10 bg-[#0A0B0D] p-7 transition-colors duration-500 hover:border-[#E9C46A]/35 hover:bg-[#11100D]">
                    <div className="mb-16 flex items-center justify-between">
                      <Icon className="h-7 w-7 text-[#E9C46A]" />
                      <span className="text-sm text-zinc-500">{scenario.note}</span>
                    </div>
                    <h3 className="text-3xl font-semibold tracking-[-0.045em] text-white">{scenario.title}</h3>
                    <p className="mt-5 max-w-md text-base leading-8 text-zinc-400">{scenario.body}</p>
                  </article>
                </RestaurantInteractiveCard>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-white/[0.08] bg-[#050506]/90 px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto grid max-w-[1500px] gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <RestaurantReveal>
            <SectionHeader title={t.sections.workflowTitle} body={t.sections.workflowBody} />
          </RestaurantReveal>
          <div className="space-y-6" data-kinetic="media">
            {t.workflow.map((step, index) => (
              <RestaurantReveal key={step.title} delay={index * 0.06}>
                <div className="grid gap-5 border-t border-white/10 py-7 md:grid-cols-[110px_1fr]">
                  <div className="font-mono text-sm text-[#36D6B7]">{String(index + 1).padStart(2, "0")}</div>
                  <div>
                    <h3 className="text-2xl font-semibold tracking-[-0.035em] text-white">{step.title}</h3>
                    <p className="mt-3 max-w-2xl text-base leading-8 text-zinc-400">{step.body}</p>
                  </div>
                </div>
              </RestaurantReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto grid max-w-[1500px] gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <RestaurantReveal>
            <SectionHeader title={t.sections.crmTitle} body={t.sections.crmBody} />
            <div className="mt-9 grid gap-4 text-base text-zinc-300 sm:grid-cols-2">
              {(locale === "ru"
                ? ["Карточки по этапам", "Фильтр по боту", "Свои поля", "Live-обновление"]
                : ["Cards by stage", "Bot filter", "Custom fields", "Live updates"]
              ).map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-[#36D6B7]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </RestaurantReveal>
          <div className="overflow-x-auto pb-3" data-kinetic="media">
            <CrmBoard cards={t.crmCards} />
          </div>
        </div>
      </section>

      <div id="pricing" className="relative z-10 border-y border-white/[0.08] bg-[#050506]">
        <LandingPricingSection />
      </div>

      <section className="relative z-10 bg-[#050506] px-5 py-20 md:px-8 md:py-28">
        <RestaurantReveal>
          <div className="mx-auto max-w-[1180px] overflow-hidden rounded-[42px] border border-white/10 bg-[linear-gradient(135deg,rgba(233,196,106,0.13),rgba(54,214,183,0.08)_42%,rgba(255,255,255,0.035))] p-8 text-center shadow-[0_44px_140px_rgba(0,0,0,0.5)] md:p-16">
            <h2 className="mx-auto max-w-4xl text-4xl font-semibold leading-[0.98] tracking-[-0.055em] text-white md:text-6xl">
              {t.sections.finalTitle}
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-zinc-300 md:text-lg">{t.sections.finalBody}</p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <RestaurantCtaMotion>
                <Link
                  href={signupHref}
                  className="group inline-flex items-center justify-center gap-4 rounded-full bg-white py-2 pl-7 pr-2 text-base font-semibold text-[#08090C] transition hover:bg-[#E9C46A]"
                >
                  {t.finalPrimary}
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/10 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5">
                    <ArrowRight className="h-5 w-5" />
                  </span>
                </Link>
              </RestaurantCtaMotion>
              <RestaurantCtaMotion delay={0.06}>
                <Link
                  href={pricingHref}
                  className="inline-flex items-center justify-center rounded-full border border-white/14 bg-black/20 px-7 py-4 text-base font-semibold text-white transition hover:bg-white/[0.08]"
                >
                  {t.finalSecondary}
                </Link>
              </RestaurantCtaMotion>
            </div>
          </div>
        </RestaurantReveal>
      </section>
    </div>
  );
}
