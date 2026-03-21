'use client';

import Image from 'next/image';
import { useLocale } from 'next-intl';
import { motion } from '@/components/motion-wrapper';
import { MessageSquareQuote, Star } from 'lucide-react';

type ReviewCopy = {
  badge: string;
  title: string;
  subtitle: string;
};

type ReviewItem = {
  name: string;
  role: string;
  image: string;
  testimonial: string;
};

const copy: Record<'ru' | 'en', ReviewCopy> = {
  ru: {
    badge: 'Отзывы пользователей',
    title: 'Что люди уже сделали с CBTooll',
    subtitle:
      'Три разных сценария, один и тот же результат: бот запущен быстрее, команда не зависит от разработчиков, а изменения можно вносить без боли.',
  },
  en: {
    badge: 'Customer reviews',
    title: 'What teams already shipped with CBTooll',
    subtitle:
      'Three different use cases, same outcome: faster launch, less dependency on developers, and painless iteration.',
  },
};

const reviews: Record<'ru' | 'en', ReviewItem[]> = {
  ru: [
    {
      name: 'Алексей Гредасов',
      role: 'AI-автоматизатор бизнеса',
      image: '/testimonials/alexey-gredasov.svg',
      testimonial:
        'Через CBTooll я быстро собрал Telegram-бота для заявок, FAQ и маршрутизации по запросу. Это заметно сократило ручные переписки и помогло быстрее доводить людей до созвона или оплаты. Сервисом пользоваться удобно, все понятно даже в быстром рабочем темпе, поэтому дальше точно буду использовать его в новых воронках.',
    },
    {
      name: 'Анастасия Морозова',
      role: 'Руководитель онлайн-школы',
      image: '/testimonials/anastasia-morozova-photo.jpg',
      testimonial:
        'Мы собрали через сервис бота для уроков, ответов по тарифам и заявок на консультацию без отдельной техкоманды. В результате перестали терять теплые обращения вечером и в выходные, а запуск занял намного меньше времени, чем мы ожидали. Сервис понравился, потому что он реально практичный, и мы продолжаем строить на нем новые сценарии для школы.',
    },
    {
      name: 'Никита Орлов',
      role: 'Операционный директор e-commerce',
      image: '/testimonials/nikita-orlov.svg',
      testimonial:
        'Мы сделали бота для каталога, статусов заказов и типовых вопросов по доставке, которые раньше постоянно забирали время у поддержки. После запуска стало меньше одинаковых обращений, а команда смогла сосредоточиться на сложных кейсах. Решение понравилось за скорость изменений и понятную логику, так что дальше будем расширять его под сезонные продажи.',
    },
  ],
  en: [
    {
      name: 'Alexey Gredasov',
      role: 'AI business automation consultant',
      image: '/testimonials/alexey-gredasov.svg',
      testimonial:
        'I used CBTooll to build a Telegram bot for leads, FAQs, and intent-based routing in very little time. It reduced manual chat work and helped move people to calls or payment much faster. The editor is clear and practical, so I will definitely keep using it for new client funnels and internal workflows.',
    },
    {
      name: 'Anastasia Morozova',
      role: 'Online school founder',
      image: '/testimonials/anastasia-morozova-photo.jpg',
      testimonial:
        'We built a bot for lessons, pricing questions, and consultation requests without a dedicated dev team. It helped us stop losing warm leads in the evenings and on weekends, and the launch was much faster than we expected. We genuinely liked the service because it is practical for non-technical teams, and we are continuing to expand it for new school products.',
    },
    {
      name: 'Nikita Orlov',
      role: 'E-commerce operations director',
      image: '/testimonials/nikita-orlov.svg',
      testimonial:
        'We built a bot for catalog browsing, order statuses, and repetitive delivery questions that used to take a lot of support time. After launch, the team had fewer repetitive conversations and could focus on more complex cases instead. The result was visible quickly, the logic is easy to manage, and we plan to keep using it for seasonal campaigns.',
    },
  ],
};

export function Testimonials() {
  const locale = useLocale();
  const lang = locale === 'ru' ? 'ru' : 'en';
  const sectionCopy = copy[lang];
  const sectionReviews = reviews[lang];
  const enterViewport = {
    once: true,
    amount: 0.12,
    margin: '280px 0px',
  } as const;

  return (
    <section className="px-4 py-24 md:py-28 relative overflow-hidden cyber-grid cyber-noise">
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={enterViewport}
          transition={{ duration: 0.42 }}
          className="mb-14 text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-mono text-white/65">
            <MessageSquareQuote className="h-4 w-4 text-[#38BDF8]" />
            <span>{sectionCopy.badge}</span>
          </div>
          <h2 className="mt-5 text-3xl font-bold md:text-5xl">
            {sectionCopy.title}
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-white/60">
            {sectionCopy.subtitle}
          </p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-3">
          {sectionReviews.map((review, index) => (
            <motion.article
              key={review.name}
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={enterViewport}
              transition={{ duration: 0.34, delay: index * 0.05 }}
              whileHover={{ y: -4 }}
              className="group relative flex h-full flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(13,18,31,0.96),rgba(8,11,20,0.98))] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.28)] transition-colors duration-150 hover:bg-[linear-gradient(180deg,rgba(14,20,36,0.98),rgba(9,12,22,1))]"
            >
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(56,189,248,0.05),transparent_38%,rgba(139,92,246,0.05))]" />
              <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-start gap-4">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0B1020]">
                    <Image
                      src={review.image}
                      alt={review.name}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-[#FFB84D]">
                      {Array.from({ length: 5 }).map((_, starIndex) => (
                        <Star key={starIndex} className="h-3.5 w-3.5 fill-current" />
                      ))}
                    </div>
                    <h3 className="mt-2 text-xl font-semibold text-white">
                      {review.name}
                    </h3>
                    <p className="mt-1 text-sm text-white/50">{review.role}</p>
                  </div>
                </div>

                <p className="mt-4 text-[15px] leading-7 text-white/80">
                  {review.testimonial}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
