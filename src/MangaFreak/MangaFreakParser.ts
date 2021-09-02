import {
    Manga,
    Chapter,
    HomeSection,
    LanguageCode,
    MangaTile,
    Tag,
} from 'paperback-extensions-common'
import { allDefined, getStatus, verifyOrThrow, } from './Util'

const IMAGES_DOMAIN = "https://images.mangafreak.net"
const MILLISECONDS_IN_DAY = 86400000

export function parseMangaDetails(mangaId: string, $: CheerioStatic): Manga {
    const mangaSeriesData = $('.manga_series_data')
    const mangaDescription = $('.manga_series_description > p')

    const mangaDataTextArray = mangaSeriesData.find('div').toArray()
    const mangaSeriesDataRows = mangaSeriesData.children()

    const alt_titles = mangaSeriesData[0]?.firstChild?.data?.split(', ').map(t => t.trim())
    const title = mangaSeriesDataRows[0]?.firstChild?.data
    const author = mangaSeriesDataRows[3]?.firstChild?.data
    const artist = mangaSeriesDataRows[4]?.firstChild?.data
    const status = getStatus(mangaDataTextArray[1]?.firstChild?.data)
    const description = mangaDescription.text()

    verifyOrThrow("Error parsing titles!", title, alt_titles)

    const titles = [title!, ...alt_titles!]

    // Tags
    const tags = mangaSeriesData.find('.series_sub_genre_list > a').toArray().map(element => {
        const id = element.attribs['href']
        const label = element.firstChild?.data

        verifyOrThrow(`Missing metadata on tags! Got id: ${id}, label: ${label}`)

        return createTag({
            id,
            label: label!
        })
    })

    const tagSection = createTagSection({ id: '0', label: "genres", tags })

    return createManga({
        id: mangaId,
        titles: titles,
        image: getImageForId(mangaId),
        rating: 0,
        status: status,
        author: author,
        artist: artist,
        desc: description,
        tags: [tagSection]
    })
}

export function parseChapters(mangaId: string, $: CheerioStatic) {
    let chapters: Chapter[] = []

    $('.manga_series_list').find('tbody').first().find('tr').each((_, element) => {
        const tableDatas = $('td', element).contents()

        const chapterString = tableDatas[0]?.firstChild?.data

        verifyOrThrow("Missing chapter name!", chapterString)

        const dateString = tableDatas[1]?.data

        verifyOrThrow("Missing date!", dateString)

        const date = new Date(dateString!)

        // Use reader url to get chapter number
        const chapRegex = tableDatas[0]?.attribs["href"]?.match(/Read1_.+_(\d+)/)

        verifyOrThrow("Missing chapter number!", chapRegex)

        const chapId = chapRegex![1]
        const chapNum = Number(chapId)

        verifyOrThrow("Could not parse chapter number!", chapId, chapNum)

        const chapter = createChapter({
            id: chapId,
            name: chapterString,
            mangaId: mangaId,
            chapNum: chapNum,
            langCode: LanguageCode.ENGLISH,
            time: date
        })

        chapters.push(chapter)
    })


    return chapters
}

export function parseChapterDetails(mangaId: string, chapterId: string, $: CheerioStatic) {
    const pageDivs = $('.mySlides > img').toArray()
    const pages = pageDivs.map(element => element.attribs['src'])

    return createChapterDetails({
        mangaId: mangaId,
        id: chapterId,
        pages: pages,
        longStrip: false
    })
}

export function parseSearchRequest($: CheerioStatic) {
    let results: MangaTile[] = $(".manga_search_item").toArray().map(element => {
        const imageSpan = $('span', element)
        const infoSpan = imageSpan.next()

        const imageLink = imageSpan.find('a')
        const id = getIdFromImageLink(imageLink)
        const titleText = infoSpan.find('h3 > a').text()

        verifyOrThrow("Missing id!", id)

        return createMangaTile({
            id: id!,
            title: createIconText({
                text: titleText
            }),
            image: getImageForId(id!)
        })
    })

    return createPagedResults({
        results
    })
}

function parseTopItem($: CheerioStatic, element: CheerioElement): MangaTile {

    const itemInfo = $('.featured_item_info', element)
    const itemImageLink = $('.featured_item_image > a', element)

    const titleLink = itemInfo.find('a')

    const id = getIdFromImageLink(itemImageLink)
    const title = titleLink.contents()[0]?.data

    verifyOrThrow(`Missing metadata in featured section! Got id: ${id}, title: ${title}`, id, title)

    return createMangaTile({
        id: id!,
        image: getImageForId(id!),
        title: createIconText({
            text: title!
        }),
    })

}

function parseFeaturedItem($: CheerioStatic, element: CheerioElement): MangaTile {
    const slideImageLink = $('a', element)

    const id = getIdFromImageLink(slideImageLink)
    const title = $('div', element).text()

    verifyOrThrow(`Missing metadata in top section! Got (id: ${id}, title: ${title})`, id, title)

    return createMangaTile({
        id: id!,
        image: getImageForId(id!),
        title: createIconText({
            text: title
        }),
    })
}

function parseListUpdatedItem($: CheerioStatic, element: CheerioElement) {
    const itemImageLink = $('a.image', element)

    const id = getIdFromImageLink(itemImageLink)
    const title = $('a.name', element).contents()[0]?.data

    verifyOrThrow(`Missing metadata in updated section! Got (id: ${id}, title: ${title})`, id, title)

    return createMangaTile({
        id: id!,
        image: getImageForId(id!),
        title: createIconText({
            text: title!
        }),
    })
}

export async function parseHomeSections(sectionCallback: (section: HomeSection) => void, cheerioPromise: Promise<CheerioStatic>) {
    async function handleHomeSection(sectionData: HomeSection, evaluate: ($: CheerioStatic) => MangaTile[]) {
        sectionCallback(sectionData)
        sectionData.items = await evaluate(await cheerioPromise)
        sectionCallback(sectionData)
    }

    let promises = [
        handleHomeSection(createHomeSection({ id: "featured", title: "FEATURED" }), $ =>
            $('ul.rslides > li').toArray().map(e => parseFeaturedItem($, e))
        ),

        handleHomeSection(createHomeSection({ id: "top", title: "TOP" }), $ =>
            $('.featured_item').toArray().map(e => parseTopItem($, e))
        ),

        handleHomeSection(createHomeSection({ id: "today", title: "UPDATED TODAY" }), $ =>
            $('.latest_item', $('.latest_list')[0]).toArray().map(e => parseListUpdatedItem($, e))
        ),

        handleHomeSection(createHomeSection({ id: "yesterday", title: "UPDATED YESTERDAY" }), $ =>
            $('.latest_item', $('.latest_list')[1]).toArray().map(e => parseListUpdatedItem($, e))
        ),

        handleHomeSection(createHomeSection({ id: "recent", title: "RECENTLY UPDATED" }), $ =>
            $('.latest_item', $('.latest_list')[2]).toArray().map(e => parseListUpdatedItem($, e))
        )
    ]

    await Promise.all(promises)
}


export function parseLatestRelease($: CheerioStatic): { updatedDate: Date, id: string }[] {
    // The precision of MangaFreak is days, so let's avoid updating unreasonably
    let today = new Date()
    today.setHours(0)
    today.setMinutes(0)

    return $('.latest_releases_item').toArray().map(element => {
        const id = getIdFromImageLink($('.latest_releases_info > a', element))

        verifyOrThrow("Missing id!", id)

        const dateString = $('.latest_releases_time', element)[0]?.firstChild?.data?.trim()

        verifyOrThrow("Missing date string!", dateString)

        let updatedDate: Date

        switch (dateString) {
            case 'Today':
                updatedDate = today
                break;
            case 'Yesterday':
                updatedDate = new Date(today.getTime() - MILLISECONDS_IN_DAY)
                break;
            default:
                updatedDate = new Date(dateString!)
                break;
        }

        return {
            updatedDate,
            id: id!
        }
    })
}


function getImageForId(id: string) {
    return `${IMAGES_DOMAIN}/manga_images/${id.toLowerCase()}.jpg`
}

function getIdFromImageLink(imageLink: Cheerio): string | undefined {
    const idRegex = imageLink.attr("href")?.match(/Manga\/(.+)/)

    if (!idRegex || idRegex.length < 2) { return undefined }

    return idRegex[1]
}