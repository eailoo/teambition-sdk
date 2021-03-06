import { RDBType, SchemaDef } from '../db'
import { SprintId, ProjectId, UserId, UserSnippet } from 'teambition-types'
import { schemaColl } from './schemas'

export interface SprintSchema {
  _id: SprintId
  _creatorId: UserId
  _projectId: ProjectId
  name: string
  startDate: string | null
  dueDate: string | null
  isDeleted: boolean
  status: 'future' | 'active' | 'complete'
  noStoryPointTaskCount: number
  created: string
  updated: string
  description: string
  executor: UserSnippet | null
  _executorId: UserId | null
}

const schema: SchemaDef<SprintSchema> = {
  _id: {
    type: RDBType.STRING,
    primaryKey: true,
  },
  _creatorId: {
    type: RDBType.STRING
  },
  _executorId: {
    type: RDBType.STRING
  },
  _projectId: {
    type: RDBType.STRING
  },
  created: {
    type: RDBType.DATE_TIME
  },
  description: {
    type: RDBType.STRING
  },
  dueDate: {
    type: RDBType.DATE_TIME
  },
  executor: {
    type: RDBType.OBJECT
  },
  isDeleted: {
    type: RDBType.BOOLEAN
  },
  name: {
    type: RDBType.STRING
  },
  noStoryPointTaskCount: {
    type: RDBType.NUMBER
  },
  startDate: {
    type: RDBType.DATE_TIME
  },
  status: {
    type: RDBType.STRING
  },
  updated: {
    type: RDBType.DATE_TIME
  }
}

schemaColl.add({ name: 'Sprint', schema })
