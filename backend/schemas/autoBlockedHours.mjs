export default {
  name: 'autoBlockedHours',
  title: 'Auto-Blocked Hours',
  type: 'document',
  fields: [
    {
      name: 'chapel',
      type: 'reference',
      title: 'Chapel',
      to: [{ type: 'chapel' }],
      description: 'Which chapel these auto-blocked hours apply to.'
    },
    {
      name: 'startHour', // e.g. "09" or "9"
      title: 'Start Hour',
      type: 'string',
      validation: (Rule) =>
        Rule.required().custom((val) => {
          const num = parseInt(val, 10)
          return (num >= 0 && num <= 23) || 'Hour must be between 0 and 23'
        })
    },
    {
      name: 'endHour', // e.g. "17" or "17"
      title: 'End Hour',
      type: 'string',
      validation: (Rule) =>
        Rule.required().custom((val) => {
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
