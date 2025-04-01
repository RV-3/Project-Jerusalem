// schemas/autoBlockedDays.js
export default {
  name: 'autoBlockedDays',
  type: 'document',
  title: 'Auto-Blocked Days',
  fields: [
    {
      name: 'daysOfWeek',
      title: 'Days of the Week',
      type: 'array',
      of: [{ type: 'string' }],
      options: {
        list: [
          { title: 'Sunday', value: 'Sunday' },
          { title: 'Monday', value: 'Monday' },
          { title: 'Tuesday', value: 'Tuesday' },
          { title: 'Wednesday', value: 'Wednesday' },
          { title: 'Thursday', value: 'Thursday' },
          { title: 'Friday', value: 'Friday' },
          { title: 'Saturday', value: 'Saturday' }
        ],
        layout: 'tags'
      }
    },
    {
      name: 'timeExceptions',
      title: 'Day Exceptions',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'timeException',
          fields: [
            { name: 'date', type: 'date', title: 'Date' },
            { name: 'startHour', type: 'string', title: 'Start Hour' },
            { name: 'endHour', type: 'string', title: 'End Hour' }
          ]
        }
      ]
    }
  ]
}
