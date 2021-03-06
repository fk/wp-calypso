/**
 * External dependencies
 */
import { By, promise, until } from 'selenium-webdriver';
import config from 'config';

/**
 * Internal dependencies
 */
import AsyncBaseContainer from '../async-base-container';
import * as driverHelper from '../driver-helper.js';
import { currentScreenSize } from '../driver-manager';
import { getJetpackHost } from '../data-helper';
import NoticesComponent from './notices-component';

export default class SecurePaymentComponent extends AsyncBaseContainer {
	constructor( driver ) {
		super(
			driver,
			By.css( '.checkout__secure-payment-form,.secure-payment-form,.composite-checkout' ),
			null,
			2 * config.get( 'explicitWaitMS' )
		);
		this.paymentButtonSelector = By.css(
			'.credit-card-payment-box button.is-primary:not([disabled]),.composite-checkout .checkout-submit-button button'
		);
		this.personalPlanSlug = getJetpackHost() === 'WPCOM' ? 'personal-bundle' : 'jetpack_personal';
		this.premiumPlanSlug = getJetpackHost() === 'WPCOM' ? 'value_bundle' : 'jetpack_premium';
		this.businessPlanSlug = getJetpackHost() === 'WPCOM' ? 'business-bundle' : 'jetpack_business';
		this.dotLiveDomainSlug = 'dotlive_domain';
	}

	async isCompositeCheckout() {
		return driverHelper.isElementPresent( this.driver, By.css( '.composite-checkout' ) );
	}

	async _postInit() {
		// This is to wait for products to settle down during sign up see - https://github.com/Automattic/wp-calypso/issues/24579
		return await driverHelper.waitTillPresentAndDisplayed(
			this.driver,
			this.paymentButtonSelector,
			this.explicitWaitMS
		);
	}

	async setInElementsIframe( iframeSelector, what, value ) {
		await this.driver.wait(
			until.ableToSwitchToFrame( By.css( iframeSelector ) ),
			this.explicitWaitMS,
			'Could not locate the ElementInput iFrame.'
		);

		await driverHelper.setWhenSettable( this.driver, By.name( what ), value, {
			pauseBetweenKeysMS: 50,
		} );

		return await this.driver.switchTo().defaultContent();
	}

	async enterTestCreditCardDetails( {
		cardHolder,
		cardNumber,
		cardExpiry,
		cardCVV,
		cardCountryCode,
		cardPostCode,
	} ) {
		// This PR introduced an issue with older browsers, specifically IE11:
		//   https://github.com/Automattic/wp-calypso/pull/22239
		const pauseBetweenKeysMS = 1;

		await this.completeContactDetails( { cardPostCode, cardCountryCode, pauseBetweenKeysMS } );

		await driverHelper.setWhenSettable(
			this.driver,
			By.css( '#name,#cardholder-name' ),
			cardHolder,
			{
				pauseBetweenKeysMS: pauseBetweenKeysMS,
			}
		);

		await this.setInElementsIframe(
			'.credit-card-form-fields .number iframe',
			'cardnumber',
			cardNumber
		);
		await this.setInElementsIframe( '.credit-card-form-fields .cvv iframe', 'cvc', cardCVV );
		await this.setInElementsIframe(
			'.credit-card-form-fields .expiration-date iframe',
			'exp-date',
			cardExpiry
		);
	}

	async completeContactDetails( { cardPostCode, cardCountryCode, pauseBetweenKeysMS } ) {
		const isCompositeCheckout = await this.isCompositeCheckout();
		if ( isCompositeCheckout ) {
			await driverHelper.setWhenSettable(
				this.driver,
				By.css( '#contact-postal-code' ),
				cardPostCode,
				{
					pauseBetweenKeysMS: pauseBetweenKeysMS,
				}
			);
			await driverHelper.clickWhenClickable(
				this.driver,
				By.css( `#country-selector option[value="${ cardCountryCode }"]` )
			);
			return driverHelper.clickWhenClickable(
				this.driver,
				By.css( 'button[aria-label="Continue with the entered contact details"]' )
			);
		}
		await driverHelper.clickWhenClickable(
			this.driver,
			By.css( `div.country select option[value="${ cardCountryCode }"]` )
		);
		return await driverHelper.setWhenSettable( this.driver, By.id( 'postal-code' ), cardPostCode, {
			pauseBetweenKeysMS: pauseBetweenKeysMS,
		} );
	}

	async submitPaymentDetails() {
		const disabledPaymentButton = By.css(
			'.credit-card-payment-box button[disabled],.composite-checkout .checkout-submit-button button[disabled]'
		);

		await driverHelper.waitTillNotPresent( this.driver, disabledPaymentButton );
		return await driverHelper.clickWhenClickable( this.driver, this.paymentButtonSelector );
	}

	async waitForCreditCardPaymentProcessing() {
		return await driverHelper.waitTillNotPresent(
			this.driver,
			By.css( '.credit-card-payment-box__progress-bar' ),
			this.explicitWaitMS * 5
		);
	}

	async waitForPageToDisappear() {
		return await driverHelper.waitTillNotPresent(
			this.driver,
			this.expectedElementSelector,
			this.explicitWaitMS * 5
		);
	}

	async getProductsNames() {
		const selector = By.css( '.product-name' );
		return await this.driver
			.findElements( selector )
			.then( ( products ) => promise.fullyResolved( products.map( ( e ) => e.getText() ) ) );
	}

	async numberOfProductsInCart() {
		const elements = await this.driver.findElements(
			By.css(
				'.product-name,.checkout-steps__step-complete-content .checkout-line-item:not([data-e2e-product-slug=""])'
			)
		);
		return elements.length;
	}

	async containsPersonalPlan() {
		return await this._cartContainsProduct( this.personalPlanSlug );
	}

	async containsPremiumPlan() {
		return await this._cartContainsProduct( this.premiumPlanSlug );
	}

	async containsBusinessPlan() {
		return await this._cartContainsProduct( this.businessPlanSlug );
	}

	async containsDotLiveDomain() {
		return await this._cartContainsProduct( this.dotLiveDomainSlug );
	}

	async payWithStoredCardIfPossible( cardCredentials ) {
		const storedCardSelector = By.css( '.credit-card__stored-card' );
		if ( await driverHelper.isEventuallyPresentAndDisplayed( this.driver, storedCardSelector ) ) {
			await driverHelper.clickWhenClickable( this.driver, storedCardSelector );
		} else {
			await this.enterTestCreditCardDetails( cardCredentials );
		}

		return await this.submitPaymentDetails();
	}

	async toggleCartSummary() {
		const isCompositeCheckout = await this.isCompositeCheckout();
		if ( isCompositeCheckout ) {
			return;
		}

		// Mobile
		if ( currentScreenSize() === 'mobile' ) {
			return await driverHelper.clickWhenClickable(
				this.driver,
				By.css( '.checkout__summary-toggle' )
			);
		}
	}

	async clickCouponButton() {
		const isCompositeCheckout = await this.isCompositeCheckout();
		if ( isCompositeCheckout ) {
			return await driverHelper.clickWhenClickable(
				this.driver,
				By.css(
					'.checkout-steps__step-complete-content .wp-checkout-order-review__show-coupon-field-button'
				)
			);
		}

		// If we're on desktop
		if ( currentScreenSize() !== 'mobile' ) {
			return await driverHelper.clickWhenClickable(
				this.driver,
				By.css( '.cart-body .cart__coupon button.cart__toggle-link' )
			);
		}

		return await driverHelper.clickWhenClickable(
			this.driver,
			By.css( '.payment-box__content .cart__coupon button.cart__toggle-link' )
		);
	}

	getCartTotalSelector() {
		if ( currentScreenSize() === 'mobile' ) {
			return By.css( '.cart__total-amount,.cart-total-amount,.wp-checkout__total-price' );
		}
		return By.css(
			'.cart__total-amount,.cart-total-amount,.wp-checkout-order-summary__total-price'
		);
	}

	async cartTotalAmount() {
		if ( currentScreenSize() === 'mobile' ) {
			await driverHelper.scrollIntoView( this.driver, this.getCartTotalSelector() );
		}
		await driverHelper.waitTillPresentAndDisplayed( this.driver, this.getCartTotalSelector() );

		const cartElement = await this.driver.findElement( this.getCartTotalSelector() );

		const cartText = await cartElement.getText();

		// We need to remove the comma separator first, e.g. 1,024 or 2,048, so `match()` can parse out the whole number properly.
		const amountMatches = cartText.replace( /,/g, '' ).match( /\d+\.?\d*/g );
		const amountString = amountMatches[ 0 ];
		return await parseFloat( amountString );
	}

	async applyCoupon() {
		await driverHelper.clickWhenClickable(
			this.driver,
			By.css(
				'button[data-e2e-type="apply-coupon"],.checkout-steps__step-complete-content .coupon button'
			)
		);
		const noticesComponent = await NoticesComponent.Expect( this.driver );
		await noticesComponent.dismissNotice();
		return this.waitForCouponToBeApplied();
	}

	async enterCouponCode( couponCode ) {
		await this.clickCouponButton();
		await driverHelper.setWhenSettable(
			this.driver,
			By.css(
				'input[data-e2e-type="coupon-code"],.checkout-steps__step-complete-content .coupon input'
			),
			couponCode
		);
		return await this.applyCoupon();
	}

	async hasCouponApplied() {
		return await driverHelper.isElementPresent( this.driver, By.css( '.cart__remove-link' ) );
	}

	async waitForCouponToBeApplied() {
		const isCompositeCheckout = await this.isCompositeCheckout();
		if ( isCompositeCheckout ) {
			await driverHelper.waitTillPresentAndDisplayed( this.driver, By.css( '.savings-list' ) );
			const savingsListElement = await this.driver.findElement( By.css( '.savings-list' ) );
			const savingsListText = await savingsListElement.getText();
			return savingsListText.includes( 'Coupon:' );
		}
		return await driverHelper.waitTillPresentAndDisplayed(
			this.driver,
			By.css( '.cart__remove-link' )
		);
	}

	async waitForCouponToBeRemoved() {
		const isCompositeCheckout = await this.isCompositeCheckout();
		if ( isCompositeCheckout ) {
			return await driverHelper.waitTillNotPresent(
				this.driver,
				By.css( '.checkout-steps__step-content .savings-list__item[data-savings-type="coupon"]' )
			);
		}
		return await driverHelper.waitTillNotPresent( this.driver, By.css( '.cart__remove-link' ) );
	}

	async removeCoupon() {
		const isCompositeCheckout = await this.isCompositeCheckout();

		if ( isCompositeCheckout ) {
			// Open review step for editing
			await driverHelper.clickWhenClickable(
				this.driver,
				By.css( '.wp-checkout__review-order-step .checkout-step__edit-button' )
			);
			// Click delete button on coupon line item
			await driverHelper.clickWhenClickable(
				this.driver,
				By.css(
					'.checkout-steps__step-content .checkout-line-item[data-product-type="coupon"] button'
				)
			);
			// Dismiss confirmation modal
			await driverHelper.clickWhenClickable(
				this.driver,
				By.css( '.checkout-modal .checkout-button.is-status-primary' )
			);
			// Make sure the coupon item in savings list is removed
			return this.waitForCouponToBeRemoved();
		}

		// Old checkout - desktop
		if ( currentScreenSize() !== 'mobile' ) {
			await driverHelper.clickWhenClickable(
				this.driver,
				By.css( '.cart-body .cart__remove-link' )
			);
			return this.waitForCouponToBeRemoved();
		}
		// Old checkout - mobile
		await driverHelper.clickWhenClickable(
			this.driver,
			By.css( '.payment-box__content .cart__remove-link' )
		);
		return this.waitForCouponToBeRemoved();
	}

	async removeFromCart() {
		return await driverHelper.clickWhenClickable(
			this.driver,
			By.css( 'button.cart__remove-item' )
		);
	}

	async cartTotalDisplayed() {
		await driverHelper.waitTillPresentAndDisplayed( this.driver, this.getCartTotalSelector() );
		return await this.driver.findElement( this.getCartTotalSelector() ).getText();
	}

	async paymentButtonText() {
		await driverHelper.waitTillPresentAndDisplayed( this.driver, this.paymentButtonSelector );
		await driverHelper.scrollIntoView( this.driver, this.paymentButtonSelector );
		return await this.driver.findElement( this.paymentButtonSelector ).getText();
	}

	async _cartContainsProduct( productSlug, expectedQuantity = 1 ) {
		await driverHelper.waitTillPresentAndDisplayed(
			this.driver,
			By.css( '.product-name,.checkout-line-item' )
		);
		const elements = await this.driver.findElements(
			By.css(
				`.product-name[data-e2e-product-slug="${ productSlug }"],.checkout-steps__step-complete-content .checkout-line-item[data-e2e-product-slug="${ productSlug }"]`
			)
		);
		return elements.length === expectedQuantity;
	}
}
