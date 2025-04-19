export default {
  name: 'reservation',
  type: 'document',
  title: 'Reservation',
  fields: [
    {
      name: 'chapel',
      type: 'reference',
      to: [{ type: 'chapel' }],
      title: 'Chapel',
      description: 'Which chapel this reservation is for.'
    },
    {
      name: 'name',
      type: 'string',
      title: 'Name'
    },
    {
      name: 'phone',
      type: 'string',
      title: 'Phone Number'
    },
    {
      name: 'start',
      type: 'datetime',
      title: 'Start Time'
    },
    {
      name: 'end',
      type: 'datetime',
      title: 'End Time'
    }
  ]
}
