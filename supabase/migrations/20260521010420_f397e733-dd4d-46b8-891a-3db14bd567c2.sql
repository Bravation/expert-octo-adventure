ALTER TABLE public.services ADD COLUMN IF NOT EXISTS photo_alts text[] NOT NULL DEFAULT '{}';

UPDATE public.services
SET photo_alts = ARRAY[
  'Custom wooden pier with hardwood decking extending over clear turquoise Caribbean water in Fajardo, Puerto Rico',
  'Marina-grade dock with reinforced concrete pilings engineered to withstand hurricane-force winds above 150 mph',
  'Coastal boardwalk built around protected coral and seagrass beds, showcasing eco-friendly marine construction',
  'Newly completed residential dock at sunset in La Parguera, Lajas, with mooring cleats and ladder',
  'Aerial view of a private waterfront pier in Puerto Rico built to IBC 2018 Puerto Rico amendments'
]
WHERE id = '80883553-a0f4-46bc-b257-a9e621618f35';