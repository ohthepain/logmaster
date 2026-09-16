// Included as English fallbacks in every locale; the translation admin can
// override these strings immediately without a native release.
export const productUiCopy = {
  equipmentTitle: 'Add Equipment',
  equipmentStage: 'Equipment',
  equipmentDocuments: 'Documents',
  equipmentConnections: 'Connections',
  equipmentFindModel: 'Find your equipment',
  equipmentFindHelp: 'Choose how to identify your equipment, then tap Search.',
  equipmentFindModePhoto: 'Photo',
  equipmentFindModeModel: 'Model',
  equipmentFindModeLink: 'Link',
  equipmentFindHelpPhoto:
    'Take a photo of the equipment or its label, then tap Search.',
  equipmentFindHelpModel: 'Enter the brand and model, then tap Search.',
  equipmentFindHelpLink:
    'Paste a manufacturer product page or datasheet link, then tap Search.',
  equipmentLinkLabel: 'Product link',
  equipmentLinkPlaceholder: 'https://example.com/product',
  equipmentSearch: 'Search',
  equipmentCamera: 'Take or choose a photo',
  equipmentCameraHint: 'A clear model label works best',
  equipmentBrand: 'Brand',
  equipmentModel: 'Model',
  equipmentNoModel: 'No model number',
  equipmentDescriptionHint:
    'Describe the equipment so you can recognize it later.',
  equipmentLooking: 'Finding your equipment…',
  equipmentLookingHelp: 'Checking the catalog and finding a product photo.',
  equipmentResults: 'Is this your equipment?',
  equipmentResultsHelp: 'Check the model and category before continuing.',
  equipmentNoPhoto: 'No product photo found',
  equipmentAdded: 'Added to the catalog {date}',
  equipmentNext: 'Next',
  equipmentBack: 'Back',
  equipmentOkay: 'Okay',
  equipmentSkip: 'Skip',
  equipmentRetry: 'Try again',
  equipmentDetails: 'More details',
  equipmentDocumentsPrompt: 'Search for documents?',
  equipmentDocumentsHelp:
    'Find manuals and instructions in your language, with English as a fallback.',
  equipmentDocumentsProgress: 'Search in progress',
  equipmentDocumentsProgressHelp:
    'You can skip this step. The search will continue in the background and documents will appear on your equipment.',
  equipmentDocumentsBackground:
    'Document search is continuing in the background.',
  equipmentDocumentsReady: 'Your documents',
  equipmentDocumentsReadyHelp:
    'Open a document to view it. These shared documents stay available with your equipment.',
  equipmentDocumentsEmpty:
    'No documents available yet. You can find or add them from the equipment page later.',
  equipmentEnglishFallback: 'English documents shown as a fallback.',
  equipmentConnectionsPrompt: 'Search for connections?',
  equipmentConnectionsHelp:
    'Look for likely connections to any equipment on this boat. You will review every suggestion.',
  equipmentConnectionBoatAssets: '{count} assets on this boat',
  equipmentConnectionsSearching: 'Finding likely connections…',
  equipmentConnectionsReview: 'Review connections',
  equipmentConnectionsReviewHelp:
    'Keep the connections that look right. Uncheck any you do not want to add.',
  equipmentConnectionsEmpty:
    'No connections selected. You can add one yourself, or finish adding the equipment.',
  equipmentAddConnection: 'Add connection',
  equipmentChooseConnection: 'Choose equipment',
  equipmentChooseConnectionHelp:
    'Other equipment and boat networks already on this boat.',
  equipmentNoConnectionCandidates:
    'There is no other equipment or boat network to connect yet.',
  equipmentManualConnection: 'Connection selected by the user.',
  equipmentProductNetworks: 'Boat networks',
  assetConnections: 'Connections',
  assetConnectionsEmpty:
    'No connections yet. Add a link to another device or a boat network.',
  assetConnectionAdd: 'Add connection',
  assetConnectionType: 'Connection type',
  assetConnectionPeer: 'Connected to',
  assetConnectionReason: 'Notes (optional)',
  assetConnectionTypeCable: 'Cable',
  assetConnectionTypeWifi: 'Wi‑Fi',
  assetConnectionTypeBluetooth: 'Bluetooth',
  assetConnectionTypeNmea0183: 'NMEA 0183',
  assetConnectionNetworkGroup: 'Boat networks',
  assetConnectionEquipmentGroup: 'Equipment',
  boatNetworkAddConnectionHelp:
    'Choose equipment to attach to this network. Other boat networks listed here do not share any equipment with this backbone yet.',
  boatNetworkOtherNetworks: 'Other networks (not linked yet)',
  boatNetworkCompatibleEquipment: 'Equipment for this network',
  boatNetworkNoConnectionCandidates:
    'No equipment can be added to this network yet. Add equipment to the boat or link products with network ports in the catalog.',
  boatNetworkLinkedNetworks: 'Linked networks',
  boatNetworkConnectDevice: 'Connect',
  boatNetworkPossibleVia: 'Via {network}',
  equipmentFinish: 'Add equipment',
  equipmentCloseConfirm:
    'Discard this equipment? It has not been added to the boat yet.',
  equipmentExistingHelp:
    'This equipment is already on your boat. Open it, merge these details, or add another unit.',
  equipmentAnotherUnit: 'Add another unit',
  productSharedConsent:
    'Use the shared product catalog. Only the brand and model are shared; your photos, notes and documents stay private to this boat.',
  productOriginalPhotoHelp:
    'Your original photo is kept with this asset. You can delete it later; it never becomes a shared product photo.',
  productSuggestConnections: 'Suggest connections to equipment on this boat',
  productLookupUnavailable:
    'Catalog lookup unavailable. You can still save this asset.',
  productMatches: 'Matching products — check the exact model and variant',
  equipmentPickModel: 'Choose the exact model',
  equipmentPickModelHelp:
    'Your search matched more than one product. Select the one that matches your unit, or correct the brand and model and search again.',
  equipmentPickModelRequired: 'Select a model from the list before continuing.',
  equipmentBrandMismatch:
    'This does not look like a {brand} product. Did you mean one of these brands?',
  equipmentSearchAgain: 'Search again',
  productPending: 'Product information pending',
  productSelected: 'Selected',
  productUse: 'Use this product',
  productReviewed: 'Reviewed',
  productUnreviewed: 'Not yet reviewed',
  productUnavailable: 'Shared product information is unavailable.',
  productLoading: 'Loading product information…',
  productInformation: 'Product information',
  productReviewedInfo:
    'Reviewed product. Localized text may be machine translated; check the manufacturer sources.',
  productCandidateInfo:
    'Research candidate — check the manufacturer sources before relying on it.',
  productFinding: 'Finding product information…',
  productFindLocalized: 'Find product information and documents in {language}',
  productLanguageFallback:
    'Shown in {language}; this language is not available yet.',
  productResearchPending:
    'Product research is pending. Your asset and personal photos are saved separately.',
  productLanguageUnknown: 'Language unknown',
  productSource: 'Source',
  productPersonalDocuments: 'Personal documents and original photos',
  productPrivateHelp:
    'These files are private to your boat. Deleting an original photo here does not affect the shared product catalog.',
} as const
