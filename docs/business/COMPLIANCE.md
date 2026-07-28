# COMPLIANCE — THE RULES WITH TEETH

Verified 2026-07-28. **Where any other doc disagrees with this file, this
file wins.**

Three separate regimes apply to this business, with three separate
enforcers. Violating the review rules is the one that can end you, because
the penalty lands on your *client's* business as well as yours.

---

## 1. REVIEWS — FTC 16 CFR PART 465

In force since October 2024. Civil penalties reach **~$51,744 per
violation**, and each individual fake review counts as its own violation.
The FTC can also seek up to 10% of global revenue derived from the
deceptive practice.

### Categorically prohibited — never, at any price

- **Buying, selling, or brokering reviews.** Creating them, commissioning
  them, or acting as the middleman. This is the business the original idea
  described. It is not a grey area.
- **Insider reviews without disclosure.** Employees, family, the owner,
  you.
- **Review suppression.** Selectively hiding or burying negatives.
- **AI-generated reviews attributed to real or invented customers.** A
  review written by a model about a service nobody received is a fake
  review regardless of how it's produced.

### Google Business Profile policy — separate from the FTC, also fatal

Enforcement is review removal, listing penalties, Local Services Ads
deactivation, or full profile suspension. Google does not warn first and
there is no meaningful appeal.

**Banned:**

- **Incentives of any kind** for reviews — discounts, credits, gift cards,
  loyalty points, entry into a drawing. Banned regardless of whether you
  ask for a positive review or just *a* review.
- **Review gating** — routing unhappy customers to a private feedback form
  while sending happy ones to Google. The most common "best practice" in
  old playbooks. It is a violation.
- **On-premises kiosks or tablets** for collecting reviews.
- *(April 2026 update)* **Review quotas for staff**, and **directing
  customers to name a specific employee** in their review.

**Explicitly allowed — this is the entire product:**

- Asking customers for reviews.
- Following up by email or SMS after a completed job.
- Linking directly to the review form.

The single governing principle: **ask every customer, identically,
regardless of how you think they feel.** Same message, same timing, same
link, no filtering. Build the automation so that filtering is not
technically possible, and you cannot drift into a violation on a busy week.

### Client-facing guardrail

Put this in the onboarding call and in writing:

> "I send the same request to every completed job. I don't screen for happy
> customers and I don't offer anything in exchange. If you offer a discount
> for reviews on your own, it puts your profile at risk and I'd have to
> stop the service."

Some owner will ask you to offer $10 off. Say no, explain the fine, and
you'll have their trust for the rest of the engagement.

---

## 2. EMAIL — CAN-SPAM

Cold email is legal. The statute governs *how*, not *whether*. Penalties
run per-email, and the requirements are cheap to satisfy:

- [ ] **Accurate header info.** Real from-name, real domain, real reply-to.
- [ ] **Non-deceptive subject line.** It must describe the actual contents.
      No fake `Re:` on a first-contact email.
- [ ] **Valid physical postal address in every message.** Street address,
      USPS-registered PO Box, or a CMRA-registered private mailbox. **This
      is the most commonly omitted element.**
- [ ] **Clear opt-out mechanism.**
- [ ] **Honor opt-outs within 10 business days.** In practice: immediately.

Deliverability is not compliance, but it rides along — Gmail and Outlook
read a complete footer as a legitimacy signal, so an incomplete one costs
you inbox placement on top of being unlawful.

**Operationally:**

- Send from a real domain, never a free Gmail address.
- Warm the domain: 10/day week 1, 20/day week 2, then up.
- Cap at ~50/day per domain.
- Keep the list tight and targeted. A precise list of 300 outperforms a
  purchased list of 10,000 on replies *and* keeps you out of spam traps.
- Maintain a suppression list. Never email an opt-out again, ever, from any
  domain.

---

## 3. SMS — A2P 10DLC

Unregistered business SMS gets filtered by carriers, not delivered and
quietly dropped. Registration is mandatory in practice.

### Brand tiers

| Tier | Eligibility | Cost |
|---|---|---|
| **Sole Proprietor** | **No** business tax ID | ~$4 brand + ~$15 vetting + ~$2/mo campaign |
| Low Volume Standard | Has EIN, <6,000 segments/day | Higher |
| Standard | Has EIN, >6,000 segments/day | Highest |

**Sole Proprietor registration is only available to those without a tax
ID.** Getting an EIN makes you *ineligible* for the cheapest tier.

**Therefore: register the sole-prop brand before obtaining an EIN.** See
`PLAYBOOK.md` §3. GoHighLevel supports sole-prop registration natively.

Sole-prop throughput is capped low — fine for a handful of local clients
doing transactional review requests and missed-call replies, not fine for
bulk campaigns. Re-register as a Standard brand when volume approaches the
cap, not before.

### Message-level rules

- Every client gets their **own** registered campaign. Never send one
  client's messages through another's brand.
- Include the business name in the first message so the recipient knows who
  is texting.
- Honor STOP immediately and automatically. Every platform handles this —
  verify it's on rather than assuming.
- Messages must match the registered use case. A campaign registered for
  customer care cannot be used for promotional blasts.

---

## 4. WHAT THIS BUSINESS NEVER DOES

A short list, because the boundary is easier to hold as a list than as a
judgment call at 6pm on a slow month:

1. Buy, sell, broker, or generate reviews.
2. Offer anything of value in exchange for a review.
3. Route unhappy customers away from the public review form.
4. Email anyone who has opted out.
5. Send SMS on an unregistered or borrowed brand.
6. Auto-submit forms or applications on anyone's behalf at scale.
7. Scrape or send to personal addresses harvested without a business
   context.

Items 1–3 are the ones that will be suggested to you by a prospect who
"just wants to get to 4.9 fast." The answer is no, and the reason is that
you'd be handing a small business a five-figure fine and a suspended
profile in exchange for $400.
