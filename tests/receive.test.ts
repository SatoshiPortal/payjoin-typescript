import {
  PayjoinReceiver,
  UncheckedProposal,
  MaybeInputsOwned,
  MaybeInputsSeen,
  OutputsUnknown,
  WantsOutputs,
  WantsInputs,
  ProvisionalProposal,
  PayjoinProposal,
} from '../src/bindings/receive';
import { PayjoinOhttpKeys } from '../src/bindings/io';
import { PayjoinRequest } from '../src/bindings/request';
import { PayjoinHttp } from '../src';

describe('PayjoinReceiver', () => {
  const validAddress = 'bcrt1qauwhftqrp57q200pp7wx75dfwfywrmla2v67dw';
  const validDirectory = 'https://payjo.in';
  const validRelay = 'https://pj.bobspacebkk.com';
  let ohttpKeys: PayjoinOhttpKeys;
  let ohttpKeysBytes: Uint8Array;

  beforeAll(async () => {
    ohttpKeys = await PayjoinOhttpKeys.fetch(validRelay, validDirectory);
    ohttpKeysBytes = await ohttpKeys.toBytes();
  });

  describe('constructor', () => {
    it.only('should create a PayjoinReceiver instance', () => {
      const receiver = new PayjoinReceiver(
        validAddress,
        validDirectory,
        ohttpKeysBytes,
        validRelay,
        BigInt(3600) // 1 hour expiry
      );
      expect(receiver).toBeInstanceOf(PayjoinReceiver);
    });

    it.only('should throw on invalid address', () => {
      expect(() => 
        new PayjoinReceiver(
          'invalid-address',
          validDirectory,
          ohttpKeysBytes,
          validRelay
        )
      ).toThrow();
    });
  });

  describe('pjUrl', () => {
    it.only('should return a valid payjoin URL (pj directory)', () => {
      const receiver = new PayjoinReceiver(
        validAddress,
        validDirectory,
        ohttpKeysBytes,
        validRelay
      );
      const url = receiver.pjUrl();
      
      // should validate something like this "https://payjo.in/X6PRLYKD6U2E7"
      const urlPattern = new RegExp(`^${validDirectory}/[A-Z0-9]{12}`);
      expect(url).toMatch(urlPattern);

      const identifier = url.split('/').pop();
      expect(identifier).toBeDefined();
      expect(identifier).toMatch(/^[A-Z0-9]{12,}$/);
    });
  });

  // Testing the state machine transitions
  describe('state machine', () => {
    let receiver: PayjoinReceiver;
    const mockResponseHex1 = '0678da607fc4110f6bdbb2d0a1a095a389c0a06c1f4809bfcf3563ad5cc4d97f7bcdde9a50d3fdcb29292e6e518e9dd784f1b742a3951fab3e7f394b71dd2dd4cb672eff2dcc9d497986a071528b76dee4a215285a0ac609e32944128b017c7ad78c39d78db9e81cb2e22f8652de75a2a720008ac993aa5636492e6cfc2355cb91d0eff120895d275bc332ee5904bf1c3da43f140a15a6c4fd8075ae1aa2f73d74b30e4bd5eadf3a318b980225b299ecf6c2959569f08be917e541e5f581f8f15d30dd3a76cdf7a8c98c99c5178f79e3f854a546f698a506268cde88d4a129baff0d507c88d6fde4d45e61ad5eff94b89730f09e30f661ad368867ae767ddf61018a2af79db279ba944e113610011bf03e37fcc843bcd0e6f8f675eef54425328fed914629b7688031f05dd46b7c1ce7687277c03aaec932a11ac50d6fb3f28551b655ef4e56aa56e147ce074fd020845578e820cc285e64ba19f3138c52677d1047bfaa5360946f697e9962a1f7948aa847492b072b990372aedfb2f9d7f2b8b4a286cedbab73050d3b8b5fc51a16e953aa0be4ad422d40128f973b7deb2e4d0aca36dc7e435500e5de3979b15a4db85e284bbbac928b88edc6cb3ac4b22fc865fc52edb72070ca6f9f4da6acd0f1781b540efc93b9683e7866c323856a7f5257f48a553a0489571dc9e7f708fb112011d40b8957c47df5b2f2525b09654967a8a7b893856f033b47ef903369e46ab0a0185415b171a11920acea54969fedb16e9df5b59bf6433adc5809adbf3ff809e2cc59f86ccf9c32dc9015c004d35e895bd29bbdf2198e460c08fa739d8eadb7fe1b7eff04f918d866334f26eef0bd8ffba908cfe710050f5ec93e293c1f44558ee97c9eba38b16974b2fe46eb2030286317de00b3781e3f03998f9861bbf3faa085513a6a41884cddbd3195e04283ca015732778fa19248dcc6aff72f9dfd8e1b3143b3f053f1370a1a23a2a62db95a686a1062794c1e7818c7e9406bc5d9861a9f04df65a94dffd7c387025dd01e8cae679ac45712cf3d8eb19d8d1db51e1ed874635811e72d0662eeae825b022cb347cdbddef369c1c3dc1a29611b5d87e803f574815e229562457cc26c8ac93c0f6cffd1677b553a329b0737e0150bf8eaf75aa6fc3e839b8667e53af945c8c51c06b19dbcd113bb7d22d9c12971db2c1482307f20b3663d3bfb55574ec8c2e45533c7afeb5451650a867b00fe06b93930abab41af95f1dccac50fc4fd1b0be3503e981d358ff5c0478a3c6db79e3821adb602412cf77a592af6b91fb99052d50a6be1969c855cff70cbc6baeb43b7a9a542f29e7ffdef7200a576ec5e6db00df95ca7cc14ad72c8f6200889e8c1a7e46313e40d8bdceb46694066cc0904f25f1328310c39edcdeac913d0de86889045fbec43d08e79dbd50bc249df35bca360e84fdfa9395837324ea6dd322d55f8dac2e85093b27c2d89edcb042bcc49d1010b4b8b9d21025a77866fdc7019081dadb655bdfc22f5d99b3dab8aa9c0328df739ba8bf40b99f71556b849b3e212a704e3d53b631cdaaf18e390b9beb1590078737f4b44f132005467b0635e9e43f679c5fe5e16ddbfb717d42d79683b607bec609af03b8689e0347e71bd6e89d6fcfa889ea477802ccd58c5a15e058438ce9272ae949119d443a056899cd7da0c4e25fb915b9b2af3e551f0ef3e0561ff5f639ff5077dae4fc078a478a2d528eab6f4115161ff60f65f12180921e364b9f7ac68e52ba3d083f31136d1d0f49524a02e06823647baa618d7b72dee3a94495fc6a31d5870f9331295c8d9e84d104836bf4ef52b900901f1145d77bdf29b3a4a6aec35c1e1210c61a04e80187a511fafe62671c6102e6d8c078034b49a8308421087ac64e577a74dc347aa9f69014191331198e18aae20bb42ee614a42c9b8dde8650f5c28e2878e8cf0faded48acdd6a636fbc81c7740ad25f68b8d9d93f0134054906e92b275fc4bb9f6612f7b076260358d4009bbbb9e8d6c42fbc612b88695dedafd87114447a0a54290e3af6f09a67022e6791ab0bf3839a0c77aff27710570118bcc48c3a88dc8de9aaa7241828bb719760b60acbecb5c29469d248d637504b515ed4bdf5e83e64a6164b0fd08e49a750b83c05674c2d0f99376215500611871c9fd9096d62262e89f7c32b27ac79a8ad037d9a62600d656969dc234c9c344abdc1cf00e4d50e8adf5a049395e6ee61d8f1616c0ac144d7054638b7a2faabb57603fcbe2f0a1fa56e5249c79f96b51c27bed2e07f6ab25f1380138eab18ae410ad436a8c41bfe17f56cd046b46cb65630ac187d1c5221201de1a65fb14037a0c9c1098a7cbad8c49b10d9cff300eaa177e1449cfcd26e91289b8856c7290517719f8c0ff78aeb331ae76287e7efc7755836bff73b82932a93b2f965eea56791819b5d5a2fc63214275167c5c7048811b9edad3c15affcb7b172b9543fc0b99495c9b7fbf0a43aff768ab78357bb0403ac57a46641a04f2488df6135b79491a1ebe8180600484de8bbbd48acebadd64559fa1170f841d4728fe3472eaaef20461456f84e3d50e972d9d3b6140b60cd28c68b15fc6a2ffc19b11d0a793af9321ba9c22a3297f6d076df13bdb0c7227838e78eb2cd3a206ff0e3aed7ba5c9035e085acbf9234cad3035d85db86b18cd33b4fb8d149a8791760a2d71608d2e56273de40784dc9b772314f85f5f0888f44aa8162828bc32a34d44be22154de2a8af3df4928aed8766f57a4b60eca4834c499826421cdebe6f02513ad61218e5cec064dc468e2c33e0487b9f63d5f3217b1d8877076370c92a601db3dda01da7a0f65ac63332b7b5a9af3bfaf9836e15d10b26c362f0a07c239292da86c6d4b692277a208c75945d0ff9a09f9b41961b77301b078cc4c34cff063cec19480562ccc1ed97a0a509baf9211fa1ff6453d43ee2d22b8f12999150a9c9f588939f3d9ec8a4d507a858baf135a75c908e6ba7e553960ffcc06d261e52e4f6987498959d540c5256d399834812501bdd7867bf46066d4b6045b337a0f6fe966b27f81bdedf855c6c9059fb6df83c4998bb948a48f31c979bfe667eeece72fefb41d2e79032d835c5f04dd413d87ee7d1e9a3fb9d4844e32177970fea4e089a9989ebdb26646bcf0f2fa05ac7440f9fa205ea926031b8079c5a923fc7ce78d51195c5135cc288a286aaf2c332dd1ce1fd7ad6360fec316ade92c8aeadeeea987ef170ae2b434fd297b531069d6cf77ba71ec1a1a1648651beca6656f68f7da3c311bbe271d17f4e16443aed517ba470ee905b3187f0af4f27c000e6e3f7975167b7186f27c5057c982010a68a4d6763e5dee2f8b15da9762c8179940875ddf84c8eeff0620f20a20bd2094595cf69f18e1631186f5c803a37e7b51956f303a6f8af727ebd36edcfae419b94ac6f0b8edc12023a6535cae431a86bb6707f94c30300d9f20dc2792db934248ae89730500a7541d66850ed593c31662b162016257366edbcb5ae033f99fefd9a2795aba69f484f3fd1ad22e2f8e59c4a09200b10afe8bcf61cfb2ff242eb9695adf0ab6041c4a1933626c186aad89751c7a5561ed1137d0750c7634e09ad5ae379a92641250e3a8ac97ac9d68ae743aca35e8d159489add20d42ae9680e31115afebe222ffbff13d85c498ecb5d1602ddf1347313601dd08ded491bc9eafa3e069151e1e9cf3a6e22cc56e77bb4811d56e0917aa684c0814e763c1aa91520a608ba1677d78021899767b18ba8ffffd7f42e52295311c5a88e77811297b8f2d72ea395876e9a0ff2ffa760bbd41762d6a7e79e011640d0214d3600bfced56c3f7b994fd64afc4bbde2f172744e9b3c8ea6f538bbc3ca7fb23eb468f4dbbc89cd1598d82eba10b324ea595b55e4c5670fd1640e5eec4f1a258c5304a7e30deb801ac477d62106b6d81d42f6836141e4f211cc720bdf2618466cb42a832dc8ddf1787cbe0c716ffa6b41cdfef65d2048d1091faffbeb00598b4cfcbfe930c8a7c88078b8b2f8e27b79ae19f05cb55123100471978d1d863d5d9bb914869d18644f0c5ba580d2ec026fa45fed8fa5cf0a839c8346fde14c16e362d2d57282052433c80668bc69c6e42b2c71d8ec7e52c01ba232edc3608377a3a39926883ba3bde5af6f6ac9122a7a55853c8e94e04724461c865ec3418b5693aff52ff5eaa2ef018476d72083d6382e861d8dc13fa4751e71caeb5d54b93c0150cc5c61efe044578c9575340b8cbfa344d1455ad7fdf25822887719e05e65e9a98855bfb333cc94bbe241ff3778c2dff71a08c19f52044ff0964a77127092e96e33eb206072bcba23aaeb627db0a0dd76e89946cc3057187ce17d6649f5067f31a1916b760b67896ec8fd93f2e7f1c41f8370af0766ec76621b1d2d1be80598003d67c3308e5df496987afadd1899224ea7bd4c4a11f8088a91a847128468b6d79997c46208dd1aec57ddffbb922faca6e2d5379bd7e3908fbd25e4fd9f3069860c82d37dd7c44470ef6a2f8b56df79945f7d916d955a8375765a86d120d7aa37e7457e46ad4fad4916e667cecb13fc0a8a99217d1abc1ff9138b417375862b60e220d843b5370af4e6a0ff23f7ef5706694780be1d5abcc7ffe8cb801834ec8fdfefae46a4aad1563706a9e4ac7713d4d70c0083c2affc8ff587a0b0e7f9807314cd3870e244f2974e9185abda96a2ad4ac1a17aef9d658c4e85d47207d5e6655e86cfbe71bdb00dd26dfcbcaf01dbd12c2786a1dd02e84b940ae2cf0fd084c4528d46e62cd6a6cb55b8a685fdfbebf7f0f548f48a9399eb2f63a8caf0f3b24152b3c1fb9f63f40b133149ccc7d00079473ef4af730245bca686408b599a07d3cc8aec99995984c0c01925bdfe8dff4cf7d1c806508c752b63e5ff4ba4441a89b73f286491829fd8734ed9f8bb9b0ed9e0f420079011d28591429855a9609838c02c11280476b2da964326dfb5367bfeaf7124f13567b2da826100b95d218f77d99f76dc7aa113e5fc1b0c1d0e3f435f30fa69264ef72de1500ccd6fe2be35ec6912133a2c3bd045ebf9753fc0ff484990e298ddf55c76babe48d6783ccfe0d20335a4dc30b0dcab242e2a4b073989dfec18fa0db000c458edd7f307b54921fac7a085ed02151dbad2c932d88640cd2e56a616746cfa32e1976c33be8960e83a0a76d51e213e8532ad758e9b2f9d44c45f1e922c3c22fcbe3d070251c7a0b5117f90a3b2c539ef9aebf70f02d1b47b3c681acac77c25b2ef6f0bb5c4db1cc15d2a617dc5f189877db06630412f88751de560caecd4d350a4e651e7d42aeef93b6ebe02bfe21a3b8ec9be48bb3c7a4b2866bb9a35a988724c4563270f1cd9549cfad55420a9ed8bb4dd740683f022cd94efe9a2e565662fca3f81505cbaf3bf527d1022a840dd412d300c987f5682cfeca1ac4a0a8767d7d789ecddcf9eb7deffdd0f27a2edfa3436c45d53f927031939bd3b48151006d735256c850a693d2cb1c1114910f20bd26650e7e6844c5a745ffdef97aed533ba52d1b28ce5f613ac2662f4540a79baf54f3087ba98500ab8fc1dfe1c00358d03b2606a98b0904be28400b9415649463ca79c88646ea442af261a352b43b70943312f1f54d85d900800ee98b34b67a4eb84f4854c8bb1a7097a9f1806f3ce2eb314151366f38d1f94d7891ef6f0dd170d0472958cea7cf4002110dbce32dc5d436a9cefefb9f52d5b82ff212a124a6625b42020bdf233b20e026e16b722e9344095457e891069806cdb8b26ff2ea8d5b9a746b74828f74c4c2e1947adeca2d705020474326b3f54fc521b9e6b0195f7fa21598789984ac197cf0db613f4180510393081a1ca5fe35fc84a7a7dd3816b44486cc17e9de0f6cfe96182b3b0aeadec5d980be8a89791c13bb756d202003bbad985ecb7a67f994198da7c23ec2534b2aefbd6ede700775f965e24afca3db0b2fbdd923875a0f22e992230d22c59fc086b376b7a30baaa6862972f658e8e44157877b4ffa0889989b74ad3e8d676cfd46e48cfad7ddda25f70248be0120ec3269791ae11947ea9bdf56ebe9fd0a3e0055057dcc924b000318ac2b0a8f94f4c1b1bc96dcd1d73e70f78548880a180755dccf2ad3b11ef897957a6b9ce93c9e31a3aa3f9a25e7fb9af99e77f80a4d553918d272b7cede8d75a3f2b4cada8d8b1a59ffef5a16f7cca00dc9ba6d8583e637a187ec1c594c02e2eecade4b36b4577dc8ba6b9e4948f8c2d5e740b3d17c76b9aba6d0565b4f77cdac3a2f11f19f020842add615a3c1ec3c21e1ead66fbea70d189801ac4ebcb8bc88ab23bb164ef61f17d4bfd02fc3966f594c56fef920f871bc65ea719ab77211a2cc8199bd723118c6440c31992d9d162631f95d940f711edf2914e4a16dc89e9a7a15820b686d403e6cd741c98759f065a1e4f4892ef92da63f7a1479e527b7f36961af13046bc0a4a95d1cbb885ffa61d440fed66735cb2725554a9ad2d471e385f96fd7bb40160c0b9631f0f94ff802c00d7813f212e07a629dbcb86c9c6a409e81c085c771da6995a73056ca36ff75a9c199d930cba1d7659eb62144def14b9a3bcc47d199fcfff44d431829cd1d683914f89514cc78f43277c7ae202da0838e7c332a49db4ad212813d885194a09204f796db939e9ff3582586a69e21b842773aebf79f431fcfd8858ca41de3b53f94105b7668066d6cae5c7e8ecd52ebbe8db2345f4b0de1ad96194184432d8bc9ddf496ac023d578c6d4aa0b4bb25fbe2223c465465da3ac385e1b992cf20a52a941b9a9521e655770acecd7517060e851497d49238f12b915b9327520914aef13828d06fe4b65f8d80eed1d7d8a9bbcda6d57fa6dcd7a63d5e4f4c50cf77b51c97718e9f693d764d1bd29836735cba9e32a9783e4cbcf9af6a6a95a56cfe63c7f4c73baf26f7f7cec5a323e58a41f8e52163f80dfb34fc2803e5a362108b44b321d5e91f9956053e0a7fc1a2afeab81321c725730ff1e2b511668fc435a90b5f2d1ac6c7dcbeeec72dd3c9be21cd83c92d3c3b1e2d4f4a42ac619489fee7a7f015ff07b745e3894d3362e2a41a9d5fdac8f9e0151441b4bccfed1b8bccd24f1d87b9b61eb2eea89eed7934ad88bbc3d28267e6ccb8928d185b6a8e005c86ec896d56ce7d294780ae8199e54a2bd5d55a62e73e8ad4d9db12260a53e7ad035db81918c89bea6bcc53ac56b21471481bdfe9494c66ae3b3b5a21dd2035a3025007c61dafe8d2468614ba4e16100cf40d1c4f8f3e8c8d3b04f62cdc19519bf1e77b43c8ede069b281e763af028c27f89f6b31d77d914d367711a8fedb7267bbd7033424f15b0608bf1f566de6c8585a8232ea94e7f93d20dc4237042a34a110d682cac194690e8da1ea5da00bd8474d085d1c23a01d64100b035c772fa8020272e595d48f6f88d461667fb6d7312d8b60fe43685762fe2f6ee60d489d1f5d3f52ad348e05ccc8faa882cf61a1d063d3cba934acf65c85c109c64a129dee0c2c80b3089886764c67dbd2b28ec6581989b43dbedd5e0949f44edf772f52fe7a2617d33e4148fd11bfb8cb6947006df96176d855704da47f29a3dba577ff204c475c42306e7a3a402f25f0592ba15065dc1692831a7db35a5abe352f470095eccfcd97a3d9539de44e682aaf1ffc16265591fd3f58a005ba3b1ddaf4d35dc39be51228999a3315cc3a45b03261a4fe02b5a7621cb264de936bd932a1c8abeeab5c56e3a6d12a37fe9b981747a7f8b93c731d1e355ece44fb4fc59f3f05b3b2cc920df4bb6d1c01c21f96a8ca9e58545b24fbe680b9cf28b71d34bb41fbace50d8e8ef3814d4e6360690a5400fe91f21503973e90c0a133674234f1ab6cc9883c3aa6133d7ecd213a4085247b3353fce0585089c9d7e5fa132c941ea2de729bbefeebb291b0964dcf7bab145026d3b8fa96450a6aa7902e43ad2cb4e96594c27a621e5583c3cf9eb261947f6811d581aea432f823c0377821273dbe4b2a31001f1583f0a2426428bb6bc86919eeaf9d198538499cb16e972321e26bce59c6335e73f88c79b1c65768973ca6a9ea81a6fb9d07e194726099639650c0d95eba72f9e1cb52d3185ce96961c7aa7709b54f806526b2377676844578dfb068233213726c4f564829120d0d4b03663e68ae19b001868438e8189b3fd4e941189811fe8ac35ef2f463119373064c26bcd04b55b62e5edd7fa05c77761b5e64e0aa87cc69a72e60b6a9728c9ea68ddcbe6b841ff67e1d596fce5bc2ff2f66b3e140748b7383402048fe6d4fd4baadcab186d9c1bb67088af935580d6ff8659e90c4f547b569106e25ef2400560ebc1ceb28402018110dc53da10f213e0a669ef872800e0a3450435ba77f7b92f58813e808a5031ffa2cb203cb2586d3863f4e2c069b69b90b868958edc8e21e8d18551b8c71f84d788ba8a6f9718f214161a23f4c215fd35cdd1a50008afeddfc1473335007505ae2da69104c8452aa1de54adda3ccc4f5c5c84ac587888c663cb632e109380f5d0f733fed5affa2ff7fd455b1cad77ea61cdfd1e7aa8f4d89468c424a1b1b0a1574c1d2816bff84d9268295f01abaf653748b53bf2832380ad9843556eecfb10705bc62834947971ea2266d58fe782cfac56a408b718820e0b0ec6e283f4abf9df7886b13a51eabb0947e3c6284431fe68fd9f088ce11ad35c246e131592a721ca039af37e2138c47372571a25636b5aa93fb681c8afbb755b2d0cd6ea64c301770f9dbf6eeab61b8e72aa3939e4b8bce20630cd84015b16f5825bdcac0a10420a375d62a706e0babe5574a8fa846f1f26b79b6b24432c7a2936777630b3654f292f91e3834cea459f7d413b5852f8bafe81fcee03f2344d1737dbdb445df9cf898e4d1a3d2bd617cdbd034eaad714ab440ad6a49539a521a3a0395a38f1da58a6dd11b1053d407bf5b475151c5535c6cd11e862a4ef82c25797c6be1d266814471940f370747da2f71b8adf71438ab88049047c8446cef438a0b06bd86b70450ffa027187f4f04cb5d31843e8eac0784c0b767516d5bfbacb9a915ad894bb7b564fbe0d7a58029101446cf7fa05f158107d8fb7e9da5bdee9558304512e22af9c4ce2c2e07086f45581bf956c8c0acc31f6f8f45eead1d601f8480032ba7d9ce38890146e218502f95e2e4a4c48c34cfcd8aaff9012ab828e53c2f7705d751c804477b22d95f9fad6add81c729c46a1c868c1086fc8165b0f34209f02a9b6e347613c0d91f6421a0868de65679659beda2cadf071b90f83b62550ccf9fe5902ffd9c89d8522ad1d391538e6d639635d366e1b4d0cd4fd342025fa61eba024cbc42f9be00ad3e9c617804192f367833880dc83643ebe5bc8fa6c25e8f1bb0d0f2b1130e24c6cecba76e5ebf5c86988872a229d63549c8f83b640cbc44a47ad28d7de26918a0d8df64b3c89b17cf5604e9e1b40d7a64f567423230eb984d5a05d4bd258015ebb3f79cf87ce43a3dc3ee3211a9493299557d3df850f251d893dc6e0e8a0a1593b35be8e1e281e23ec19d4e3cd22a7692338c2981f1f6ec593d846a7e92e47abf349220919c07350c722119628b3dd5a93f5bd02b94d1c5780493f5869ee3ac0a53b7d205519af3fdc9113786c17789fe1755e53c7cff6df136e23cbcd3949f621fd9d6f85f50f17a25de8e0ec42107ed66735ebbce51a42bdee7f8f848c772a58add00531dd4c1107a9fe51b2510cbcd821f89f88d675f33d4ec1c4891f00043e462acb81cdcd906d33cf0c8e082ddc0f114aa5bb134dba2e63c1c5117c5f0c90f89332d24fc508dd3d9ad6d7694985fe283614fd3259a687ece15a1dd88f9ee017c0072a658baca15bdd36059929a8672cbdd49cd7dffb64ddb268d715b6ac9df752e07c0caed22943fa2f64901b70fc654d19b539d5fe41c498d87f1cfaaaacbd34e5f653c6811ef26652421b0b4f598d98dc2760fcf2fbb294965eac438098d3876dc46b6431b511fa8bdd1599328f874a365b19ff0f1aaa2bc3ec18152139bfc5e5430927dc7fffc5869b04cddb09ddd8b0016484b87fd02997863bbd17aef339a0d8226a86c084021db36dfef45dd197d2837823fe8d086376d00d83e650b2dd58502bf12eacb6b2d03cb748a83fb3a005ff2db69b876f37386a64ac252591215d0e2edfa4b7e7c436214b4d94773d932e3abf27bd12f1718bdf391639984f0a1daba3e9dd2a6f01d64b6d05b6e619c9d5ee3c57b04725fdf8e1c011e60b10fe81f3af570129a5c1464d0fe155087364ec6bcb0a06deb378a6492e35331f7b9893ff3cfe0010eef0d3d12a441e9569dfe8e84f1b6721286be876c9f6d075437cf0c08a2ce73933d43345d56219b7ea5fee00e8ffb683d4e2748875ea063d0534ffecd5b88d616ea70e63155dd2d653b04e940c4731ab891019b33740e8648156c3b936137b8561399e8a13a14eff1e364ae8ec1f0ce1c8ee9b3bd0da2299b2f2bfe13c6ca00e2ddd56dcd459bc143a797ac0b6f1de2a49eaf6618c986929400aca2c130f6816e8ed61581f5b91b372a7f1e51289c6b9dc0397a94ca4b6e1d8438eff62e2e6ddea3db7671f7c6e3bfad30355ace75b55ca965181b32cedf5fbbe8b3b63a8af8790c359f94619ea85713b7860b8a117f62369e4af872cf85f1fc55a219c03798cc72bc1ea078945bf0fd32baf9f95619203859866f2835d1fd4c992be47e1c20218452a9ee3f9e1204f8ac0d797df4f7650ee510120e82ef7d9c781764aa672e3051b67603350d9f044759553ee29d0629a4a15c146db6e25d5f68544018d1d17e5a00cd882694ba6fa9c745dbdcfe5cfed12c655c05e447423177a5c2fd554f6cc6a7031d3bd7e2c6fc93c98c7d2259105b3ef37bf1c06124f1ea1c8f3eca17a73f312834b1928e3e866561278e711d815b31819b6f1152ce42d03b51e165bfcb97f006f070216f3bed8f46277e00234eab7cd8c9be538580afbe7d6f3bc784bc8fe452851c8fa64b8bb00649b26d1441bb7c266ae334fbd743c91d604d479ca380ae9156e90f8a22dbc08cadb2760945f78fbaa07fbcfa236536e566d0ce1827e66f32730b4dcdb89fd105aef20bd9a54a2e9645092b66d7e56babc6747e174fd9114b4510ecdc0e6b1602da1fc2701a4cc59d2324f202beab89ff42ce35d9f2e54c6813f6c9c505ad84012428dc805a4ca5408363f8270b5e6c3877508a3620c5d9d70d53ccaf6042bc5f9718d21668eeb960fb9a5ca85de59c27f1114c30a0a5e68fad31862550f1e009d6f78893a4dfab7ca1eb3eaa1f6e85d3cd15792c37ab9fc2c01da6094ae7a8430e7795ab94521f37643187c342e8ce456c5a034f9dbba8c842b4a1d245b818074e220e1e1b775b2e1eabf337b8d6bbd4a739fdc33a93f02da1af81fa8b0197dd19149510a5b30e2dc194c033fc0258d131ae65ac36c03f60c3d97c2e7c10ea995cdd9ec0a24e47ce0198b54742d7cb450ff327884d2e6ec94d276786114c9e91b58c522642d2159993a3bb226560076efa1844bd0c764b30d25f9ea7956e073b63ee416b3250df1e224ee7f4';
    const mockResponse1 = new Uint8Array(Buffer.from(mockResponseHex1, 'hex'));
    const mockResponse = new Uint8Array([1, 2, 3]);
    const mockScript = new Uint8Array([4, 5, 6]);
    const mockPsbt = 'cHNidP8BAJoCAAAA...'; // shortened for brevity
    
    beforeEach(async () => {
      receiver = new PayjoinReceiver(
        validAddress,
        validDirectory,
        ohttpKeysBytes,
        validRelay
      );
    });
  
    describe('request handling', () => {
      it.only('should extract request', async () => {
        const request = await receiver.extractRequest();
        expect(request).toBeInstanceOf(PayjoinRequest);
      });
  
      it.only('should process response and return UncheckedProposal', async () => {
        const request = await receiver.extractRequest();
        const response = await request.post();

        expect(response).toBeInstanceOf(Uint8Array);

        const uncheckedProposal = await receiver.processResponse(response, request);
        expect(uncheckedProposal).toBeInstanceOf(UncheckedProposal);
      }, 60000); // @todo remember to remove this timeout
    });
  
    describe('proposal verification', () => {
      let uncheckedProposal: UncheckedProposal;
  
      beforeEach(async () => {
        const request = await receiver.extractRequest();
        uncheckedProposal = await receiver.processResponse(mockResponse, request) as UncheckedProposal;
      });
  
      it('should check broadcast suitability', async () => {
        const result = await uncheckedProposal.checkBroadcastSuitability(
          null,
          async () => true
        );
        expect(result).toBeInstanceOf(MaybeInputsOwned);
      });
  
      it('should verify inputs not owned', async () => {
        const maybeInputsOwned = await uncheckedProposal.checkBroadcastSuitability(
          null,
          async () => true
        );
        const result = await maybeInputsOwned.checkInputsNotOwned(
          async () => false
        );
        expect(result).toBeInstanceOf(MaybeInputsSeen);
      });
  
      it('should check for previously seen inputs', async () => {
        const maybeInputsOwned = await uncheckedProposal.checkBroadcastSuitability(
          null,
          async () => true
        );
        const maybeInputsSeen = await maybeInputsOwned.checkInputsNotOwned(
          async () => false
        );
        const result = await maybeInputsSeen.checkNoInputsSeenBefore(
          async () => false
        );
        expect(result).toBeInstanceOf(OutputsUnknown);
      });
    });
  
    describe('output handling', () => {
      let outputsUnknown: OutputsUnknown;
  
      beforeEach(async () => {
        const request = await receiver.extractRequest();
        const uncheckedProposal = await receiver.processResponse(mockResponse, request) as UncheckedProposal;
        const maybeInputsOwned = await uncheckedProposal.checkBroadcastSuitability(null, async () => true);
        const maybeInputsSeen = await maybeInputsOwned.checkInputsNotOwned(async () => false);
        outputsUnknown = await maybeInputsSeen.checkNoInputsSeenBefore(async () => false);
      });
  
      it('should identify receiver outputs', async () => {
        const result = await outputsUnknown.identifyReceiverOutputs(async () => true);
        expect(result).toBeInstanceOf(WantsOutputs);
      });
  
      it('should handle output substitution', async () => {
        const wantsOutputs = await outputsUnknown.identifyReceiverOutputs(async () => true);
        const result = await wantsOutputs.substituteReceiverScript(mockScript);
        expect(result).toBeInstanceOf(WantsOutputs);
      });
  
      it('should handle output replacement', async () => {
        const wantsOutputs = await outputsUnknown.identifyReceiverOutputs(async () => true);
        const result = await wantsOutputs.replaceReceiverOutputs(
          [[mockScript, 1000]],
          mockScript
        );
        expect(result).toBeInstanceOf(WantsOutputs);
      });
    });
  
    describe('finalization', () => {
      let wantsInputs: WantsInputs;
  
      beforeEach(async () => {
        const request = await receiver.extractRequest();
        const uncheckedProposal = await receiver.processResponse(mockResponse, request) as UncheckedProposal;
        const maybeInputsOwned = await uncheckedProposal.checkBroadcastSuitability(null, async () => true);
        const maybeInputsSeen = await maybeInputsOwned.checkInputsNotOwned(async () => false);
        const outputsUnknown = await maybeInputsSeen.checkNoInputsSeenBefore(async () => false);
        const wantsOutputs = await outputsUnknown.identifyReceiverOutputs(async () => true);
        wantsInputs = wantsOutputs.commitOutputs();
      });
  
      it('should contribute inputs', async () => {
        const result = await wantsInputs.tryContributeInputs([{
          prevout: new Uint8Array([1, 2, 3]),
          script_sig: new Uint8Array([]),
          witness: [],
          sequence: 0xffffffff,
          psbt_data: {}
        }]);
        expect(result).toBeInstanceOf(ProvisionalProposal);
      });
  
      it('should finalize proposal', async () => {
        const provisionalProposal = await wantsInputs.tryContributeInputs([{
          prevout: new Uint8Array([1, 2, 3]),
          script_sig: new Uint8Array([]),
          witness: [],
          sequence: 0xffffffff,
          psbt_data: {}
        }]);
        const result = await provisionalProposal.finalizeProposal(
          async () => mockPsbt,
          null,
          2.0
        );
        expect(result).toBeInstanceOf(PayjoinProposal);
      });
  
      it('should have correct proposal properties', async () => {
        const provisionalProposal = await wantsInputs.tryContributeInputs([{
          prevout: new Uint8Array([1, 2, 3]),
          script_sig: new Uint8Array([]),
          witness: [],
          sequence: 0xffffffff,
          psbt_data: {}
        }]);
        const payjoinProposal = await provisionalProposal.finalizeProposal(
          async () => mockPsbt,
          null,
          2.0
        );
        
        expect(payjoinProposal.utxosToLocked()).toBeInstanceOf(Array);
        expect(typeof payjoinProposal.isOutputSubstitutionDisabled()).toBe('boolean');
        expect(typeof payjoinProposal.psbt()).toBe('string');
      });
    });
  });
});