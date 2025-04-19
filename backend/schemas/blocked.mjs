// blocked.js
export default {
  name: 'blocked',
  type: 'document',
  title: 'Blocked (Manual)',
  fields: [
    {
      name: 'chapel',
      type: 'reference',
      to: [{ type: 'chapel' }],
      title: 'Chapel',
      description: 'Which chapel this manual block applies to.'
    },
    {
      name: 'start',
      type: 'datetime',
      title: 'Blocked Start'
    },
    {
      name: 'end',
      type: 'datetime',
      title: 'Blocked End'
    }
  ]
}
