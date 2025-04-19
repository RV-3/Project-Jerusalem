// chapels.mjs

export default {
  name: 'chapel',
  type: 'document',
  title: 'Chapel',
  fields: [
    {
      name: 'name',
      type: 'string',
      title: 'Chapel Name',
      validation: (Rule) => Rule.required()
    },
    {
      name: 'nickname',
      type: 'string',
      title: 'Nickname',
      description: 'An optional short name or nickname for the chapel.'
    },
    {
      name: 'timezone',
      type: 'string',
      title: 'Timezone',
      description: 'e.g. "Europe/Vienna", "America/New_York"',
      validation: (Rule) => Rule.required()
    },
    {
      name: 'slug',
      type: 'slug',
      title: 'URL Slug',
      options: {
        source: 'name',
        maxLength: 96,
        slugify: (input) =>
          input
            .toLowerCase()
            .replace(/\s+/g, '-')
            .slice(0, 96)
      },
      validation: (Rule) => Rule.required()
    },
    {
      name: 'description',
      title: 'Description',
      type: 'array',
      of: [{ type: 'block' }], // Rich text (Portable Text blocks)
      description: 'Rich text description about the chapel.'
    },
    {
      name: 'whatsappNumber',
      title: 'WhatsApp Number',
      type: 'string',
      description: 'Optional contact number for WhatsApp.'
    },
    {
      name: 'chapelImage',
      title: 'Chapel Image',
      type: 'image',
      options: {
        hotspot: true // allow cropped focal points if you like
      },
      description: 'Upload or select an image representing this chapel.'
    },
    {
      name: 'language',
      title: 'Default Language',
      type: 'string',
      description: 'Set the default language for this chapel.',
      options: {
        list: [
          { title: 'English', value: 'en' },
          { title: 'Deutsch', value: 'de' },
          { title: 'Español', value: 'es' },
          { title: 'العربية', value: 'ar' }
        ]
      }
    },
    {
      name: 'city',
      title: 'City',
      type: 'string',
      description: 'City or region where the chapel is located.'
    },
    {
      name: 'location',
      title: 'Location (Lat/Lng)',
      type: 'geopoint',
      description: 'Geographic location of the chapel (used for the map).'
    },
    {
      name: 'googleMapsLink',
      title: 'Google Maps Link',
      type: 'url',
      description: 'Optional direct link to this chapel on Google Maps.'
    }
  ]
};
