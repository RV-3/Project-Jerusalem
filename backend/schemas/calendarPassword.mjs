export default {
  name: 'calendarPassword',
  title: 'Calendar Password',
  type: 'document',
  fields: [
     {
       name: 'chapel',
       type: 'reference',
       title: 'Chapel',
       to: [{ type: 'chapel' }],
       description: 'Which chapel this password applies to.'
     },
    {
      name: 'password',
      title: 'Password',
      type: 'string',
      description: 'The global (or chapel-specific) calendar password. Leave blank to make the calendar public.'
    }
  ]
}
