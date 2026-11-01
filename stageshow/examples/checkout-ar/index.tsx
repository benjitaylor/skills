import { Stage, Phone, Bar, BrandMark, Icon, Money, Notification, Spinner, States, mirror, type Act } from '../../kit'
import './checkout.css'

// An Arabic checkout on a phone, written right to left: the gold for rtl
// scenes (references/rtl.md). Story in four beats: a checkout sheet rises
// over a store page (context), a tap on ادفع (action), the button works and
// then confirms on itself, and the bank's notification drops in with the
// amount it took (result, the poster). It loops by closing the sheet, a
// visible cause, and the sheet rises fresh.
//
// What rtl changes, and the scene leaves to the kit: the stage's dir flips
// every row (title on the right, close on the left, the card's chevron
// pointing left), the status bar mirrors (time on the right, the battery
// facing left), digits are Eastern Arabic, and the riyal sign sits on the
// number's left as SAMA sets it. The only direction in this file is in the
// cursor's resting place, written with mirror().
//
// Real strings: the store's name (it carries the frame between loops),
// إتمام الطلب, الإجمالي, the amount, the card's last four, ادفع / تم الدفع,
// and the notification. Everything else is a line or a shape.

type Phase = 'idle' | 'working' | 'paid'
type S = { open: boolean; phase: Phase; banner: boolean }

const START: S = { open: false, phase: 'idle', banner: false }
const TOTAL = 187.5
const W = 400

// Off to one side of the phone, toward the start of the line
const REST = mirror({ x: 120, y: 470 }, W, 'rtl')

const script = async (a: Act<S>) => {
  await a.wait(500)
  a.put({ open: true })
  await a.wait(1500)
  a.mark('pay')
  await a.click('pay')
  a.put({ phase: 'working' })
  // The finger lifts where it tapped while the payment goes through
  await a.wait(1300)
  a.put({ phase: 'paid' })
  await a.wait(500)
  a.put({ banner: true })
  await a.wait(2800)
  // The banner times out and rises away on its own, as iOS dismisses one
  a.put({ banner: false })
  await a.wait(600)
  a.mark('close')
  await a.click('close')
  a.put({ open: false })
  await a.wait(800)
  // Below the screen now: reset unseen, then it rises fresh
  await a.snap({ phase: 'idle' })
  await a.move(REST)
  await a.wait(200)
}

export default function CheckoutAr() {
  return (
    <Stage<S>
      width={W}
      height={520}
      compact={{ below: 400, width: 358, height: 530 }}
      dir="rtl"
      initial={START}
      poster={{ open: true, phase: 'paid', banner: true }}
      script={script}
      cursor={{ at: REST, style: 'touch' }}
      className="co"
    >
      {(s, _rect, layout) => (
        <>
          <div className="co-wash" />
          <Phone width={layout === 'compact' ? 326 : 300} className="co-phone">
            {/* The store page the sheet rises over: art and lines only */}
            <div className="co-store" data-back={s.open || undefined}>
              <div className="co-store__head">
                <span className="co-store__name">متجر نخلة</span>
                <span className="co-store__bag" />
              </div>
              <div className="co-store__hero" />
              <div className="co-store__grid">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="co-store__item">
                    <span className="co-store__art" data-i={i} />
                    <Bar w={i % 2 ? 64 : 82} h={7} r={3} tone={3} />
                    <Bar w={40} h={7} r={3} tone={2} />
                  </span>
                ))}
              </div>
            </div>

            <section className="co-sheet" data-open={s.open || undefined}>
              <span className="co-sheet__grab" />
              <header className="co-head">
                <span className="co-title">إتمام الطلب</span>
                <span className="co-close" data-target="close">
                  <Icon name="close" size={14} stroke={2} />
                </span>
              </header>

              <div className="co-items">
                {[
                  { name: 92, qty: 34, price: 46 },
                  { name: 70, qty: 30, price: 40 },
                ].map((row, i) => (
                  <div key={i} className="co-item">
                    <span className="co-item__art" data-i={i} />
                    <span className="co-item__text">
                      <Bar w={row.name} h={8} r={3} tone={4} />
                      <Bar w={row.qty} h={6} r={3} tone={2} />
                    </span>
                    <Bar w={row.price} h={8} r={3} tone={3} />
                  </div>
                ))}
              </div>

              <div className="co-total">
                <span className="co-total__label">الإجمالي</span>
                <Money value={TOTAL} weight={2.6} className="co-total__value" />
              </div>

              <div className="co-method">
                <BrandMark brand="visa" size={30} />
                <span className="co-method__card">•••• 4417</span>
                <Icon name="chevron-right" size={16} stroke={2} className="co-method__go" />
              </div>

              <span className="co-pay" data-target="pay" data-phase={s.phase}>
                <States
                  value={s.phase}
                  states={{
                    idle: <>ادفع</>,
                    working: <Spinner size={18} />,
                    paid: (
                      <>
                        <Icon name="check" size={18} stroke={2.4} /> تم الدفع
                      </>
                    ),
                  }}
                />
              </span>

              {/* The fine print under the button, a line that runs off the crop */}
              <div className="co-note">
                <Icon name="lock" filled size={12} />
                <Bar w={150} h={6} r={3} tone={2} />
              </div>
            </section>

            {/* Kept mounted, so it can rise away rather than vanish */}
            <Notification
                banner
                data-show={s.banner || undefined}
                className="co-banner"
                icon={<Icon name="card" filled size={20} />}
                title="مصرفي"
                time="الآن"
                body="تم خصم 187.50 ر.س من بطاقة فيزا"
              />
          </Phone>
        </>
      )}
    </Stage>
  )
}
