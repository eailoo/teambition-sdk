import 'rxjs/add/observable/throw'
import 'rxjs/add/operator/startWith'
import 'rxjs/add/operator/withLatestFrom'
import { Observable } from 'rxjs/Observable'
import { OperatorFunction } from 'rxjs/interfaces'
import { Omit } from '../utils'

export type PageToken = string & { kind: 'PageToken' }

export const emptyPageToken = '' as PageToken

export enum Kind {
  PageCount = 'PageCount',
  PageToken = 'PageToken'
}

export type CommonState<T = {}> = {
  kind: Kind

  urlPath: string

  pageSize: number
  urlQuery?: {}

  result: T[]

  nextPage: number
  hasMore: boolean
  limit: number
}

export type PageCountState<T = {}> = CommonState<T> & {
  kind: Kind.PageCount
}

export type PageTokenState<T = {}> = CommonState<T> & {
  kind: Kind.PageToken
  nextPageToken: PageToken
  totalSize?: number
}

export type State<T = {}> = PageTokenState<T>

export type PolyState<T = {}> = PageCountState<T> | PageTokenState<T>

export type StateOptions = {
  kind?: Kind
  pageSize?: number
  urlQuery?: {}
}

export type InitOptions<T extends {} = {}> = Omit<StateOptions, 'kind'> & {
  urlQuery?: T
}

export type Update<T> = {
  patch?: T[]
  limit?: number
}

export function defaultState<T>(urlPath: string, options: StateOptions & { kind: Kind.PageCount }): PageCountState<T>
export function defaultState<T>(urlPath: string): PageTokenState<T>
export function defaultState<T>(urlPath: string, options: Omit<StateOptions, 'kind'>): PageTokenState<T>
export function defaultState<T>(urlPath: string, options: StateOptions & { kind: Kind.PageToken }): PageTokenState<T>
export function defaultState<T>(urlPath: string, options: StateOptions): PolyState<T>
export function defaultState<T>(
  urlPath: string,
  options: StateOptions = {}
): PolyState<T> {
  const state: CommonState<T> = {
    kind: options.kind || Kind.PageToken,
    urlPath,
    result: [],
    nextPage: 1,
    hasMore: true,
    urlQuery: undefined,
    pageSize: 50,
    limit: 0
  }

  if (options.urlQuery) {
    const { pageSize: queryPageSize, ...nonPaginationQuery } = options.urlQuery as any
    state.urlQuery = nonPaginationQuery
    state.pageSize = queryPageSize || state.pageSize
  }
  state.pageSize = options.pageSize || state.pageSize

  return state.kind === Kind.PageCount
    ? state as PageCountState<T>
    : { ...state, nextPageToken: emptyPageToken, totalSize: undefined } as PageTokenState<T>
}

// todo: test, doc
export function queryInfo<T>(state: CommonState<T>): Update<T> {
  return { patch: state.result, limit: state.limit }
}

export type OriginalResponse<T> = {
  nextPageToken: PageToken
  result: T[]
  totalSize?: number
}

export function accUpdate<T>(state: PageCountState<T>, resp: T[]): PageCountState<T>
export function accUpdate<T>(state: PageTokenState<T>, resp: OriginalResponse<T>): PageTokenState<T>
export function accUpdate<T>(state: PolyState<T>, resp: OriginalResponse<T> | T[]): PolyState<T>
export function accUpdate<T>(
  state: PolyState<T>,
  resp: OriginalResponse<T> | T[]
): PolyState<T> {
  const nextPage = state.nextPage + 1
  const limit = state.nextPage * state.pageSize

  switch (state.kind) {
    case Kind.PageCount: {
      const r = resp as T[]
      const hasMore = r.length === state.pageSize
      const result = r
      return { ...state, nextPage, limit, hasMore, result }
    }
    case Kind.PageToken: {
      const r = resp as OriginalResponse<T>
      const hasMore = Boolean(r.nextPageToken) && r.result.length === state.pageSize
      const result = r.result
      const nextPageToken = r.nextPageToken
      const totalSize = r.totalSize
      return { ...state, nextPage, limit, hasMore, result, nextPageToken, totalSize }
    }
    default:
      return state // 没有对应的操作，将 state 原样返回
  }
}

export function accConcat<T>(state: PageCountState<T>, resp: T[]): PageCountState<T>
export function accConcat<T>(state: PageTokenState<T>, resp: OriginalResponse<T>): PageTokenState<T>
export function accConcat<T>(state: PolyState<T>, resp: OriginalResponse<T> | T[]): PolyState<T>
export function accConcat<T>(state: PolyState<T>, resp: OriginalResponse<T> | T[]): PolyState<T> {
  const nextState = accUpdate(state, resp)
  if (nextState === state) {
    return nextState // 没有对应的操作，将 state 原样返回
  }
  nextState.result = state.result.concat(nextState.result)
  return nextState
}

export function expand<T>(
  step: (curr: PageCountState<T>) => Observable<T[]>,
  accumulate: (state: PageCountState<T>, resp: T[]) => PageCountState<T>,
  initState: PageCountState<T>
): OperatorFunction<{}, Observable<PageCountState<T>>>

export function expand<T>(
  step: (curr: PageTokenState<T>) => Observable<OriginalResponse<T>>,
  accumulate: (state: PageTokenState<T>, resp: OriginalResponse<T>) => PageTokenState<T>,
  initState: PageTokenState<T>
): OperatorFunction<{}, Observable<PageTokenState<T>>>

export function expand<T>(
  step: ((curr: PolyState<T>) => Observable<unknown>),
  accumulator: (state: PolyState<T>, resp: any) => PolyState<T>,
  initState: PolyState<T>
): OperatorFunction<{}, Observable<PolyState<T>>>

export function expand<T>(
  step: ((curr: any) => Observable<any>),
  accumulator: (state: any, resp: any) => PolyState<T>,
  initState: PolyState<T>
): OperatorFunction<{}, Observable<PolyState<T>>> {
  return (source$) => {
    const state = { ...initState }
    let isLoading = false

    return new Observable((observer) => {
      const subs = source$.subscribe({
        next: (_) => {
          if (!state.hasMore) {
            observer.complete()
            return
          }
          if (!isLoading) {
            isLoading = true
            observer.next(step(state)
              .map((stepResult) => accumulator(state, stepResult))
              .do((expanded) => Object.assign(state, expanded))
              .catch((err) => Observable.throw(err))
              .finally(() => { isLoading = false })
            )
          }
        },
        error: (err) => {
          isLoading = false
          observer.error(err)
        },
        complete: () => {
          observer.complete()
        }
      })

      return () => {
        subs.unsubscribe()
      }
    })
  }
}
