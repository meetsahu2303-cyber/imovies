import { Link } from 'react-router-dom';
import { Armchair, CreditCard, QrCode, RotateCcw, ArrowRight } from 'lucide-react';
import { PageHeading } from '../components/UI';
export default function Help() {
  return (
    <div className="container page-space help-page">
      <PageHeading
        eyebrow="A SMOOTH SHOW FROM START TO FINISH"
        title="Your movie night, made simple."
        description="Everything you need to know before the opening credits."
      />
      <div className="help-grid">
        {[
          {
            icon: Armchair,
            title: '1. Find your perfect seat',
            text: 'Choose a movie, city, date, and showtime. Select up to 8 available seats. Your selection is held for 5 minutes, with live updates if another moviegoer selects a seat.',
          },
          {
            icon: CreditCard,
            title: '2. Make it official',
            text: 'Sign in and review your booking. In this demo, choose a simulated successful or declined payment. No card details are collected and no money is charged. If configured, Stripe handles real checkout securely.',
          },
          {
            icon: QrCode,
            title: '3. Your tickets, all in one place',
            text: 'A successful payment confirms your seats and creates a ticket with a QR reference. Find it under My bookings, save the ticket details, or print it. Demo tickets are not valid for actual cinema admission.',
          },
          {
            icon: RotateCcw,
            title: 'Plans changed? That’s okay.',
            text: 'Cancel a confirmed booking up to 2 hours before the show. Seats return to availability and a refund is initiated. Demo refunds are instant; Stripe refunds depend on your bank. An administrator can assist with late cancellations.',
          },
        ].map(({ icon: Icon, title, text }) => (
          <article key={title}>
            <Icon size={27} />
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <div className="help-note">
        <strong>A note on this project</strong>
        <p>
          IMovies is a full-stack demonstration cinema. The cinemas, schedules, show ratings, and
          prices are illustrative. Artwork belongs to its respective owners. Movie listings are
          seeded sample data, not current cinema listings.
        </p>
      </div>
      <Link to="/movies" className="btn btn-primary">
        Let’s find a film
        <ArrowRight size={17} />
      </Link>
    </div>
  );
}
