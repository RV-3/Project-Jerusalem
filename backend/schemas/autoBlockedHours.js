// schemas/autoBlockedHours.js
export default {
  name: 'autoBlockedHours',
  title: 'Auto-Blocked Hours',
  type: 'document',
  fields: [
    {
      name: 'startHour',      // e.g. "09" or 9
      title: 'Start Hour',
      type: 'string',         // or 'number' if you prefer, but 'string' is fine
      validation: Rule => Rule.required().custom(val => {
        const num = parseInt(val, 10)
        return (num >= 0 && num <= 23) || 'Hour must be between 0 and 23'
      })
    },
    {
      name: 'endHour',        // e.g. "17" or 17
      title: 'End Hour',
      type: 'string',
      validation: Rule => Rule.required().custom(val => {
        const num = parseInt(val, 10)
        return (num >= 1 && num <= 24) || 'Hour must be between 1 and 24'
      })
    },
    {
      name: 'timeExceptions',
      title: 'Time Exceptions',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'date', type: 'date', title: 'Date (YYYY-MM-DD)' },
            {
              name: 'startHour',
              type: 'string', // "09"
              title: 'Exception Start Hour'
            },
            {
              name: 'endHour',
              type: 'string', // "10"
              title: 'Exception End Hour'
            }
          ]
        }
      ]
    }
  ]
}
