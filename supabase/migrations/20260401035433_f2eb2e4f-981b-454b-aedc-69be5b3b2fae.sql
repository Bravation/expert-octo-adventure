INSERT INTO public.notifications (user_id, type, title, message, data)
VALUES (
  'a6259152-d0ff-48f9-8de1-9da69eaf023e',
  'milestone',
  'Milestone Reached! 🎉',
  'You reached 10 positive reviews! Your booking fee dropped from 10.00% to 9.00%.',
  '{"positive_reviews": 10, "old_fee": 10, "new_fee": 9, "title_es": "¡Hito Alcanzado! 🎉", "message_es": "Alcanzaste 10 reseñas positivas. Tu tarifa de reserva bajó de 10.00% a 9.00%."}'::jsonb
);