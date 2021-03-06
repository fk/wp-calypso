/**
 * External Dependencies
 */
import { get } from 'lodash';

/**
 * Returns the current search query.
 *
 * @param  {object}  state  Global state tree
 * @returns {string}        The current search query
 */
export default function getSearchQuery( state ) {
	return get( state, 'inlineHelp.searchResults.search.searchQuery', '' );
}
