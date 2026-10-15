import { expect, fixture, oneEvent, nextFrame, aTimeout, waitUntil } from '@open-wc/testing';
import '../src/autocomplete-input';
import { assert } from '@esm-bundle/chai';
import { sendKeys } from '@web/test-runner-commands';

it('renders the slot when in initial state', async () => {
  const el = await fixture(`
    <autocomplete-input name="foo">bar</autocomplete-input>
  `);
  expect(el.innerHTML).to.equal('bar');
})

it('displays an input when opened', async () => {
  const el = await fixture(`
    <autocomplete-input name="foo" search-value="abc">bar</autocomplete-input>
  `);
  el.shadowRoot.querySelector('button.display-wrapper').click();
  await el.updated;
  const searchInput = el.shadowRoot.querySelector('input');
  expect(searchInput).to.exist;
  expect(el.hasState('open')).to.be.true;
});

it('emits an autocomplete-search event', async () => {
  const el = await fixture(`
    <autocomplete-input name="foo" open debounce="10"></autocomplete-input>
  `);
  const searchInput = el.shadowRoot.querySelector('input');
  searchInput.value = 'bar';
  searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  const { detail } = await oneEvent(el, 'autocomplete-search');
  expect(detail.query).to.equal('bar');
  expect(detail.name).to.equal('foo');
});

it('only dispatches search event when the mininum length is met', async () => {
  const el = await fixture(`
    <autocomplete-input name="foo" open min-length="3" debounce="10"></autocomplete-input>
  `);
  el.addEventListener('autocomplete-search', () => { 
    assert.fail();
  });
  const searchInput = el.shadowRoot.querySelector('input');
  searchInput.value = 'f';
  searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  await el.updated;
});

describe('the combobox', () => {
  it('builds a combobox and sends autocomplete-commit for a slotted list', async () => {
    const el = await fixture(`
      <autocomplete-input name="bar" open items='[{"value": "foo", "label": "Foo"}]'>
      </autocomplete-input>
    `);
    const option = el.shadowRoot.querySelector('li[data-value="foo"]');
    el.addEventListener('autocomplete-commit', (e) => {
      console.debug(e.detail)
      expect(e.detail.value).to.equal('foo');
      expect(e.detail.name).to.equal('bar');
    });
    option.click();
  });

  it('sets values when an option is clicked', async () => {
    const formElement = await fixture(`
        <form>
          <autocomplete-input name="foo" open items='[{"value": "bar", "label": "Bar"}]'>
          </autocomplete-input>
        </form>
      `);
    const autocompleteElement = formElement.querySelector('autocomplete-input');
    const option = autocompleteElement.shadowRoot.querySelector('li[data-value="bar"]');
    option.click();
    expect(new FormData(formElement).get('foo')).to.eq('bar');
  });

  it('sets form value from value attribute', async () => {
    const formElement = await fixture(`
      <form>
        <autocomplete-input name="foo" value="bar" open>
          <ul slot="list">
            <li role="option" data-value="bar">Bar</li>
          </ul>
        </autocomplete-input>
      </form>
    `);
    expect(new FormData(formElement).get('foo')).to.eq('bar')
  });

});

describe('the closed-state trigger', () => {
  const trigger = (el) => el.shadowRoot.querySelector('button.display-wrapper');
  const focusOnTrigger = (el) =>
    waitUntil(() => trigger(el) && el.shadowRoot.activeElement === trigger(el), 'focus did not return to the trigger');
  const focusOnInput = (el) =>
    waitUntil(() => el.searchInput && el.shadowRoot.activeElement === el.searchInput, 'focus did not move to the search input');
  const count = (el, type) => {
    const events = [];
    el.addEventListener(type, (e) => events.push(e));
    return events;
  };

  it('is a button with type="button" and the trigger part', async () => {
    const el = await fixture(`<autocomplete-input name="foo" display-value="Alice"></autocomplete-input>`);
    expect(trigger(el).getAttribute('type')).to.equal('button');
    expect(trigger(el).getAttribute('part')).to.equal('trigger');
    expect(trigger(el).querySelector('span').textContent).to.equal('Alice');
  });

  it('uses the label as its accessible name when there is no display text', async () => {
    const el = await fixture(`<autocomplete-input name="foo" display-value="" label="Reassign owner"></autocomplete-input>`);
    expect(trigger(el).getAttribute('aria-label')).to.equal('Reassign owner');
    expect(trigger(el).querySelector('span')).to.be.null;
  });

  it('keeps the display text first in its accessible name', async () => {
    const el = await fixture(`<autocomplete-input name="foo" display-value="Alice" label="Reassign owner"></autocomplete-input>`);
    expect(trigger(el).getAttribute('aria-label')).to.equal('Alice, Reassign owner');
  });

  it('has no aria-label without a label, so the display text names it', async () => {
    const el = await fixture(`<autocomplete-input name="foo" display-value="Alice"></autocomplete-input>`);
    expect(trigger(el).hasAttribute('aria-label')).to.be.false;
  });

  it('is reachable with Tab and opens once on Enter, focusing the search input', async () => {
    const el = await fixture(`<autocomplete-input name="foo" display-value="" label="Pick"></autocomplete-input>`);
    const opens = count(el, 'autocomplete-open');
    await sendKeys({ press: 'Tab' });
    await focusOnTrigger(el);
    await sendKeys({ press: 'Enter' });
    await focusOnInput(el);
    expect(opens.length).to.equal(1);
    expect(el.open).to.be.true;
  });

  it('opens once on Space, focusing the search input', async () => {
    const el = await fixture(`<autocomplete-input name="foo"></autocomplete-input>`);
    const opens = count(el, 'autocomplete-open');
    trigger(el).focus();
    await sendKeys({ press: 'Space' });
    await focusOnInput(el);
    expect(opens.length).to.equal(1);
    expect(el.open).to.be.true;
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const el = await fixture(`<autocomplete-input name="foo"></autocomplete-input>`);
    const closes = count(el, 'autocomplete-close');
    trigger(el).focus();
    await sendKeys({ press: 'Enter' });
    await focusOnInput(el);
    await sendKeys({ press: 'Escape' });
    await focusOnTrigger(el);
    expect(el.open).to.be.false;
    expect(closes.length).to.equal(1);
  });

  it('returns focus to the trigger when the clear button closes it', async () => {
    const el = await fixture(`<autocomplete-input name="foo" open></autocomplete-input>`);
    el.shadowRoot.querySelector('button.cancel-icon').click();
    await focusOnTrigger(el);
    expect(el.open).to.be.false;
  });

  it('commits once and returns focus to the trigger when an option is clicked', async () => {
    const el = await fixture(`<autocomplete-input name="foo" open items='[{"value": "bar", "label": "Bar"}]'></autocomplete-input>`);
    const commits = count(el, 'autocomplete-commit');
    el.shadowRoot.querySelector('li[data-value="bar"]').click();
    await focusOnTrigger(el);
    expect(el.open).to.be.false;
    expect(commits.length).to.equal(1);
  });
});

describe('the open search input', () => {
  const trigger = (el) => el.shadowRoot.querySelector('button.display-wrapper');

  it('is named by the label', async () => {
    const el = await fixture(`<autocomplete-input name="foo" open label="Reassign owner"></autocomplete-input>`);
    expect(el.searchInput.getAttribute('aria-label')).to.equal('Reassign owner');
  });

  it('has no aria-label without a label', async () => {
    const el = await fixture(`<autocomplete-input name="foo" open></autocomplete-input>`);
    expect(el.searchInput.hasAttribute('aria-label')).to.be.false;
  });

  it('commits a highlighted option exactly once on Enter and does not reopen', async () => {
    const el = await fixture(`<autocomplete-input name="foo" open items='[{"value": "bar", "label": "Bar"}, {"value": "baz", "label": "Baz"}]'></autocomplete-input>`);
    const commits = [];
    let opens = 0;
    el.addEventListener('autocomplete-commit', (e) => commits.push(e.detail));
    el.addEventListener('autocomplete-open', () => { opens += 1; });
    await waitUntil(() => el.shadowRoot.activeElement === el.searchInput);
    await sendKeys({ press: 'ArrowDown' });
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => trigger(el) && el.shadowRoot.activeElement === trigger(el), 'focus did not return to the trigger');
    await aTimeout(50);
    expect(commits.map((d) => d.value)).to.deep.equal(['bar']);
    expect(opens).to.equal(0);
    expect(el.open).to.be.false;
  });

  it('commits a typed custom value exactly once on Enter when nothing is highlighted', async () => {
    const el = await fixture(`<autocomplete-input name="foo" open allow-custom-value debounce="10" items='[{"value": "bar", "label": "Bar"}]'></autocomplete-input>`);
    const commits = [];
    el.addEventListener('autocomplete-commit', (e) => commits.push(e.detail));
    await waitUntil(() => el.shadowRoot.activeElement === el.searchInput);
    await sendKeys({ type: 'custom' });
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => commits.length > 0);
    await aTimeout(50);
    expect(commits.map((d) => d.value)).to.deep.equal(['custom']);
    expect(el.open).to.be.false;
  });

  it('does not commit on Enter without a highlighted option or custom values', async () => {
    const el = await fixture(`<autocomplete-input name="foo" open items='[{"value": "bar", "label": "Bar"}]'></autocomplete-input>`);
    let commits = 0;
    el.addEventListener('autocomplete-commit', () => { commits += 1; });
    await waitUntil(() => el.shadowRoot.activeElement === el.searchInput);
    await sendKeys({ type: 'zzz' });
    await sendKeys({ press: 'Enter' });
    await aTimeout(50);
    expect(commits).to.equal(0);
    expect(el.open).to.be.true;
  });
});
