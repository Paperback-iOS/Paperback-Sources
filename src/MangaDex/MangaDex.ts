/* eslint-disable camelcase, @typescript-eslint/explicit-module-boundary-types, radix, unicorn/filename-case */
import {
  PagedResults,
  Source,
  Manga,
  Chapter,
  ChapterDetails,
  HomeSection,
  SearchRequest,
  SourceInfo,
  LanguageCode,
  TagType,
  MangaUpdates,
  MangaStatus,
  MangaTile,
  Tag,
  RequestHeaders
} from 'paperback-extensions-common'

const entities = require("entities")

const MANGADEX_DOMAIN = 'https://mangadex.org'
const MANGADEX_API = 'https://api.mangadex.org'
const COVER_BASE_URL = 'https://uploads.mangadex.org/covers'

export const MangaDexInfo: SourceInfo = {
  author: 'nar1n',
  description: 'Extension that pulls manga from MangaDex',
  icon: 'icon.png',
  name: 'MangaDex',
  version: '1.1.5',
  authorWebsite: 'https://github.com/nar1n',
  websiteBaseURL: MANGADEX_DOMAIN,
  hentaiSource: false,
  language: LanguageCode.ENGLISH,
  sourceTags: [
    {
      text: 'Recommended',
      type: TagType.BLUE,
    },
    // Temporarily disabled
    // {
    //   text: "Notifications",
    //   type: TagType.GREEN
    // }
  ],
}

export class MangaDex extends Source {

  languageMapping: any = {
    'en': 'gb',
    'pt-br': 'pt',
    'ru': 'ru',
    'fr': 'fr',
    'es-la': 'es',
    'pl': 'pl',
    'tr': 'tr',
    'it': 'it',
    'es': 'es',
    'id': 'id',
    'vi': 'vn',
    'hu': 'hu',
    'zh': 'cn',
    'ar': 'sa',
    'de': 'de',
    'zh-hk': 'hk',
    'ca': 'es', // Catalan
    'th': 'th',
    'bg': 'bg',
    'fa': 'ir',
    'uk': 'ua',
    'mn': 'mn',
    'he': 'il',
    'ro': 'ro',
    'ms': 'my',
    'tl': 'ph',
    'ja': 'jp',
    'ko': 'kr',
    'hi': 'in',
    'my': 'my',
    'cs': 'cz',
    'pt': 'pt',
    'nl': 'nl',
    'sv': 'se',
    'bn': 'bd',
    'no': 'no',
    'lt': 'lt',
    'sr': 'rs',
    'da': 'dk',
    'fi': 'fi',
  }

  requestManager = createRequestManager({
    requestsPerSecond: 4,
    requestTimeout: 15000,
  })

  getMangaShareUrl(mangaId: string): string {
    return `${MANGADEX_DOMAIN}/title/${mangaId}`
  }

  globalRequestHeaders(): RequestHeaders {
    return {
      referer: `${MANGADEX_DOMAIN}/`
    }
  }

  async getMangaUUIDs(numericIds: string[]): Promise<{[id: string]: string}> {
    const length = numericIds.length
    let offset = 0
    const UUIDsDict:{[id: string]: string} = {}

    while (true) {
      const request = createRequestObject({
        url: `${MANGADEX_API}/legacy/mapping`,
        method: 'POST',
        headers: {'content-type': 'application/json'},
        data: {
          'type': 'manga',
          'ids': numericIds.slice(offset, offset + 500).map(x => Number(x))
        }
      })
      offset += 500
    
      const response = await this.requestManager.schedule(request, 1)
      const json = (typeof response.data) === "string" ? JSON.parse(response.data) : response.data

      for (const mapping of json) {
        UUIDsDict[mapping.data.attributes.legacyId] = mapping.data.attributes.newId
      }

      if (offset >= length) {
        break
      }
    }

    return UUIDsDict
  }

  async getMDHNodeURL(chapterId: string): Promise<string> {
    const request = createRequestObject({
      url: `${MANGADEX_API}/at-home/server/${chapterId}`,
      method: 'GET',
    })
    
    const response = await this.requestManager.schedule(request, 1)
    const json = (typeof response.data) === "string" ? JSON.parse(response.data) : response.data

    return json.baseUrl
  }

  async getCustomListRequestURL(listId: string): Promise<string> {
    const request = createRequestObject({
      url: `${MANGADEX_API}/list/${listId}`,
      method: 'GET',
    })
    
    const response = await this.requestManager.schedule(request, 1)
    const json = (typeof response.data) === "string" ? JSON.parse(response.data) : response.data

    return `${MANGADEX_API}/manga?limit=100&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includes[]=cover_art&ids[]=${json.relationships.filter((x: any) => x.type == 'manga').map((x: any) => x.id).join('&ids[]=')}`
  }

  async getMangaDetails(mangaId: string): Promise<Manga> {
    let newMangaId: string
    if (!mangaId.includes('-')) {
      // Legacy Id
      const UUIDsDict = await this.getMangaUUIDs([mangaId])
      newMangaId = UUIDsDict[mangaId]
    } else {
      newMangaId = mangaId
    }

    const request = createRequestObject({
      url: `${MANGADEX_API}/manga/${newMangaId}?includes[]=author&includes[]=artist&includes[]=cover_art`,
      method: 'GET',
    })
    
    const response = await this.requestManager.schedule(request, 1)
    const json = (typeof response.data) === "string" ? JSON.parse(response.data) : response.data

    const mangaDetails = json.data.attributes
    const titles = [mangaDetails.title[Object.keys(mangaDetails.title)[0]]].concat(mangaDetails.altTitles.map((x: any)  => this.decodeHTMLEntity(x[Object.keys(x)[0]])))
    const desc = this.decodeHTMLEntity(mangaDetails.description.en).replace(/\[\/{0,1}[bus]\]/g, '')  // Get rid of BBcode tags

    let status = MangaStatus.COMPLETED
    if (mangaDetails.status == 'ongoing') {
      status = MangaStatus.ONGOING
    }
    const tags: Tag[] = []
    for (const tag of mangaDetails.tags) {
      const tagName: {[index: string]: string} = tag.attributes.name
      tags.push(createTag({
        id: tag.id,
        label: Object.keys(tagName).map(keys => tagName[keys])[0]
      }))
    }
    
    const author = json.relationships.filter((x: any) => x.type == 'author').map((x: any) => x.attributes.name).join(', ')
    const artist = json.relationships.filter((x: any) => x.type == 'artist').map((x: any) => x.attributes.name).join(', ')

    const coverFileName = json.relationships.filter((x: any) => x.type == 'cover_art').map((x: any) => x.attributes?.fileName)[0]
    let image: string
    if (coverFileName) {
      image = `${COVER_BASE_URL}/${newMangaId}/${coverFileName}`
    } else {
      image = 'https://mangadex.org/_nuxt/img/cover-placeholder.d12c3c5.jpg'
    }

    return createManga({
      id: mangaId,
      titles,
      image,
      author,
      artist,
      desc,
      rating: 5,
      status,
      tags: [createTagSection({
        id: "tags",
        label: "Tags",
        tags: tags
      })]
    })
  }

  async getChapters(mangaId: string): Promise<Chapter[]> {
    let newMangaId: string
    if (!mangaId.includes('-')) {
      // Legacy Id
      const UUIDsDict = await this.getMangaUUIDs([mangaId])
      newMangaId = UUIDsDict[mangaId]
    } else {
      newMangaId = mangaId
    }

    const chapters: Chapter[] = []
    let offset = 0

    while (true) {
      const request = createRequestObject({
      url: `${MANGADEX_API}/manga/${newMangaId}/feed?limit=500&offset=${offset}&includes[]=scanlation_group`,
      method: 'GET',
      })
      const response = await this.requestManager.schedule(request, 1)
      const json = (typeof response.data) === "string" ? JSON.parse(response.data) : response.data
      offset += 500

      if(json.results === undefined) throw new Error(`Failed to parse json results for ${newMangaId}`)

      for (const chapter of json.results) {
        const chapterId = chapter.data.id
        const chapterDetails = chapter.data.attributes
        const name =  this.decodeHTMLEntity(chapterDetails.title)
        const chapNum = Number(chapterDetails?.chapter)
        const volume = Number(chapterDetails?.volume)
        let langCode = chapterDetails.translatedLanguage
        if (Object.keys(this.languageMapping).includes(langCode)) {
          langCode = this.languageMapping[chapterDetails.translatedLanguage]
        } else {
          langCode = '_unknown'
        }

        const time = new Date(chapterDetails.publishAt)

        const group = chapter.relationships.filter((x: any) => x.type == 'scanlation_group').map((x: any) => x.attributes.name).join(', ')

        chapters.push(createChapter({
          id: chapterId,
          mangaId: mangaId,
          name,
          chapNum,
          volume,
          langCode,
          group,
          time
        }))
      }

      if (json.total <= offset) {
        break
      }
    }

    return chapters
  }

  async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
    if (!chapterId.includes('-')) {
      // Numeric ID
      throw new Error('OLD ID: PLEASE REFRESH AND CLEAR ORPHANED CHAPTERS')
    }

    const serverUrl = await this.getMDHNodeURL(chapterId)

    const request = createRequestObject({
      url: `${MANGADEX_API}/chapter/${chapterId}`,
      method: 'GET',
    })

    const response = await this.requestManager.schedule(request, 1)
    const json = (typeof response.data) === "string" ? JSON.parse(response.data) : response.data

    const chapterDetails = json.data.attributes
    const pages = chapterDetails.data.map(
      (x: string) => `${serverUrl}/data/${chapterDetails.hash}/${x}`
    )

    return createChapterDetails({
      id: chapterId,
      mangaId: mangaId,
      pages,
      longStrip: false
    })
  }

  async searchRequest(query: SearchRequest, metadata: any): Promise<PagedResults> {
    let offset: number = metadata?.offset ?? 0
    let results: MangaTile[] = []

    const request = createRequestObject({
      url: `${MANGADEX_API}/manga?title=${encodeURIComponent(query.title ?? '')}&limit=100&offset=${offset}&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includes[]=cover_art`,
      method: 'GET',
    })

    const response = await this.requestManager.schedule(request, 1)
    if (response.status != 200) {
      return createPagedResults({results})
    }

    const json = (typeof response.data) === "string" ? JSON.parse(response.data) : response.data

    if(json.results === undefined) {throw new Error(`Failed to parse json for the given search`)}

    for (const manga of json.results) {
      const mangaId = manga.data.id
      const mangaDetails = manga.data.attributes
      const title = this.decodeHTMLEntity(mangaDetails.title[Object.keys(mangaDetails.title)[0]])
      const coverFileName = manga.relationships.filter((x: any) => x.type == 'cover_art').map((x: any) => x.attributes?.fileName)[0]
      let image: string
      if (coverFileName) {
        image = `${COVER_BASE_URL}/${mangaId}/${coverFileName}.256.jpg`
      } else {
        image = 'https://mangadex.org/_nuxt/img/cover-placeholder.d12c3c5.jpg'
      }

      results.push(createMangaTile({
        id: mangaId,
        title: createIconText({text: title}),
        image
      }))
    }

    return createPagedResults({
      results,
      metadata: {offset: offset + 100}
    })
  }

  async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
    const sections = [
      {
        request: createRequestObject({
          url: await this.getCustomListRequestURL('a153b4e6-1fcc-4f45-a990-f37f989c0d74'),
          method: 'GET',
        }),
        section: createHomeSection({
          id: 'seasonal',
          title: 'SEASONAL',
          view_more: true,
        }),
      },
      {
        request: createRequestObject({
          url: `${MANGADEX_API}/manga?limit=20&&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includes[]=cover_art`,
          method: 'GET',
        }),
        section: createHomeSection({
          id: 'popular',
          title: 'POPULAR TITLES',
          view_more: true,
        }),
      },
      {
        request: createRequestObject({
          url: `${MANGADEX_API}/manga?limit=20&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includes[]=cover_art&order[updatedAt]=desc`,
          method: 'GET',
        }),
        section: createHomeSection({
          id: 'recently_updated',
          title: 'RECENTLY UPDATED TITLES',
          view_more: true,
        }),
      },
    ]
    const promises: Promise<void>[] = []

    for (const section of sections) {
      // Let the app load empty sections
      sectionCallback(section.section)

      // Get the section data
      promises.push(
        this.requestManager.schedule(section.request, 1).then(async response => {
          const json = (typeof response.data) === "string" ? JSON.parse(response.data) : response.data
          let results = []

          if(json.results === undefined) throw new Error(`Failed to parse json results for section ${section.section.title}`)

          for (const manga of json.results) {
            const mangaId = manga.data.id
            const mangaDetails = manga.data.attributes
            const title = this.decodeHTMLEntity(mangaDetails.title[Object.keys(mangaDetails.title)[0]])
            const coverFileName = manga.relationships.filter((x: any) => x.type == 'cover_art').map((x: any) => x.attributes?.fileName)[0]
            let image: string
            if (coverFileName) {
              image = `${COVER_BASE_URL}/${mangaId}/${coverFileName}.256.jpg`
            } else {
              image = 'https://mangadex.org/_nuxt/img/cover-placeholder.d12c3c5.jpg'
            }

            results.push(createMangaTile({
              id: mangaId,
              title: createIconText({text: title}),
              image
            }))
          }

          section.section.items = results
          sectionCallback(section.section)
        }),
      )
    }

    // Make sure the function completes
    await Promise.all(promises)
  }

  async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults | null> {
    let offset: number = metadata?.offset ?? 0
    let collectedIds: string[] = metadata?.collectedIds ?? []
    let results: MangaTile[] = []
    let url: string = ''

    switch(homepageSectionId) {
      case 'seasonal': {
        url = await this.getCustomListRequestURL('8018a70b-1492-4f91-a584-7451d7787f7a')
        break
      }
      case 'popular': {
        url = `${MANGADEX_API}/manga?limit=100&offset=${offset}&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includes[]=cover_art`
        break
      }
      case 'recently_updated': {
        url = `${MANGADEX_API}/manga?limit=100&offset=${offset}&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includes[]=cover_art&order[updatedAt]=desc`
        break
      }
    }

    const request = createRequestObject({
      url,
      method: 'GET',
    })

    const response = await this.requestManager.schedule(request, 1)
    const json = (typeof response.data) === "string" ? JSON.parse(response.data) : response.data

    if(json.results === undefined) throw new Error(`Failed to parse json results for getViewMoreItems`)

    for (const manga of json.results) {
      const mangaId = manga.data.id
      const mangaDetails = manga.data.attributes
      const title = this.decodeHTMLEntity(mangaDetails.title[Object.keys(mangaDetails.title)[0]])
      const coverFileName = manga.relationships.filter((x: any) => x.type == 'cover_art').map((x: any) => x.attributes?.fileName)[0]
      let image: string
      if (coverFileName) {
        image = `${COVER_BASE_URL}/${mangaId}/${coverFileName}.256.jpg`
      } else {
        image = 'https://mangadex.org/_nuxt/img/cover-placeholder.d12c3c5.jpg'
      }

      if (!collectedIds.includes(mangaId)) {
        results.push(createMangaTile({
          id: mangaId,
          title: createIconText({text: title}),
          image
        }))
        collectedIds.push(mangaId)
      }
    }

    return createPagedResults({
      results,
      metadata: {offset: offset + 100, collectedIds}
  })
  }

  async filterUpdatedManga(mangaUpdatesFoundCallback: (updates: MangaUpdates) => void, time: Date, ids: string[]): Promise<void> {
    let legacyIds: string[] = ids.filter(x => !x.includes('-'))
    let conversionDict: {[id: string]: string} = {}
    if (legacyIds.length != 0 ) {
      conversionDict = await this.getMangaUUIDs(legacyIds)
      for (const key of Object.keys(conversionDict)) {
        conversionDict[conversionDict[key]] = key
      }
    }

    let offset = 0
    const maxRequests = 100
    let loadNextPage = true
    let mangaToUpdate: string[] = []
    let updatedManga: string[] = []
    const updatedAt = time.toISOString().split('.')[0] // They support a weirdly truncated version of an ISO timestamp

    while (loadNextPage) {
      const request = createRequestObject({
        url: `${MANGADEX_API}/chapter?limit=100&offset=${offset}&publishAtSince=${updatedAt}&order[publishAt]=desc`,
        method: 'GET',
      })

      const response = await this.requestManager.schedule(request, 1)

      // If we have no content, there are no updates available
      if(response.status == 204) {
        return
      }

      const json = (typeof response.data) === "string" ? JSON.parse(response.data) : response.data

      if(json.results === undefined) {
        // Log this, no need to throw.
        console.log(`Failed to parse JSON results for filterUpdatedManga using the date ${updatedAt} and the offset ${offset}`)
        return
      }

      for (const chapter of json.results) {
        const mangaId = chapter.relationships.filter((x: any)=> x.type == 'manga')[0]?.id

        if (ids.includes(mangaId) && !updatedManga.includes(mangaId)) {
          mangaToUpdate.push(mangaId)
          updatedManga.push(mangaId)
        } else if (ids.includes(conversionDict[mangaId])) {
          mangaToUpdate.push(conversionDict[mangaId])
          updatedManga.push(mangaId)
        }
      }
      
      offset = offset + 100
      if (json.total <= offset || offset >= 100 * maxRequests) {
        loadNextPage = false
      }
      if (mangaToUpdate.length > 0) {
        mangaUpdatesFoundCallback(createMangaUpdates({
            ids: mangaToUpdate
        }))
      }
      mangaToUpdate = []
    }
    mangaUpdatesFoundCallback(createMangaUpdates({ids: []}))
  }

  decodeHTMLEntity(str: string): string {
    return entities.decodeHTML(str)
  }
}
