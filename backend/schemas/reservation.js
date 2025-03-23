export default {
  name: 'reservation',
  type: 'document',
  title: 'Reservation',
  fields: [
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
