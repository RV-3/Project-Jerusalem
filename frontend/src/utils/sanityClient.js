import sanityClient from '@sanity/client'

if (
  !process.env.REACT_APP_SANITY_PROJECT_ID ||
  !process.env.REACT_APP_SANITY_TOKEN ||
  !process.env.REACT_APP_SANITY_DATASET
) {
  throw new Error('[Sanity] Missing required environment variables')
}

const client = sanityClient({
  projectId: process.env.REACT_APP_SANITY_PROJECT_ID,
  dataset: process.env.REACT_APP_SANITY_DATASET,
  token: process.env.REACT_APP_SANITY_TOKEN,
  useCdn: false,
  apiVersion: '2023-01-01'
})

console.log('[Sanity] Connected to:', process.env.REACT_APP_SANITY_PROJECT_ID)

export default client
