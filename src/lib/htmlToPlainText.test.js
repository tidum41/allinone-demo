import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { htmlToPlainText, htmlToTaskLines } from './htmlToPlainText.js'

describe('htmlToPlainText', () => {
  it('converts br and block boundaries to newlines instead of concatenating', () => {
    assert.equal(
      htmlToPlainText('buy milk tomorrow<div>Pick up suit</div>'),
      'buy milk tomorrow\nPick up suit'
    )
    assert.equal(
      htmlToPlainText('one<br>two<br/>three'),
      'one\ntwo\nthree'
    )
    assert.equal(
      htmlToPlainText('<div>alpha</div><div>beta</div>'),
      'alpha\nbeta'
    )
  })

  it('strips rich formatting tags while keeping text', () => {
    assert.equal(
      htmlToPlainText('<b>bold</b> and <i>italic</i>'),
      'bold and italic'
    )
  })

  it('decodes common entities', () => {
    assert.equal(htmlToPlainText('A&nbsp;&amp;&nbsp;B'), 'A & B')
  })
})

describe('htmlToTaskLines', () => {
  it('splits concatenated contenteditable HTML into separate tasks', () => {
    assert.deepEqual(
      htmlToTaskLines('finish essay tomorrow<div>Pick up suit</div><div>call mom</div>'),
      ['finish essay tomorrow', 'Pick up suit', 'call mom']
    )
  })

  it('drops empty lines', () => {
    assert.deepEqual(
      htmlToTaskLines('a<br><br>b'),
      ['a', 'b']
    )
  })
})
