/** Kullanma Kılavuzu — "Kapasite Kuralları" bölümü. */
export function RulesGuide() {
  return (
    <div className="guide-content">
      <p className="note">
        Bu bölüm ileri düzeydir ve genellikle bir kez ayarlanıp bırakılır. Kurallar, planlamanın kaç
        kapı/gün hesapladığını doğrudan etkiler; değiştirmeden önce mantığını anlamak önemlidir.
      </p>

      <h2>Ne işe yarar?</h2>
      <p>
        <strong>Kapasite Kuralları</strong>, bir ekibin bir kapıyı ne kadar sürede taktığını —
        dolayısıyla <strong>günde kaç adet</strong> çıkarabileceğini — belirli koşullara göre
        değiştirir. Örneğin “büyük kanatlı kapılar daha yavaş takılır” ya da “kırım/sökme olan işlerde
        kapasite yarıya iner” gibi gerçekleri sisteme öğretir.
      </p>

      <h2>Liste ekranı</h2>
      <p>
        Tanımlı tüm kurallar listelenir. Sağ üstteki <strong>“Yeni Kural”</strong> ile kural eklenir;
        her kural <strong>Düzenle / Sil</strong> edilebilir.
      </p>

      <h2>Yeni kural ekleme — alanlar</h2>
      <ul>
        <li>
          <strong>Ad:</strong> Kuralın adı (ör. <em>Büyük kanat −%20</em>). Sadece sizin için bir
          etikettir.
        </li>
        <li>
          <strong>Aktif:</strong> İşaretliyse kural uygulanır. Kaldırırsanız kural silinmeden{" "}
          <strong>devre dışı</strong> kalır.
        </li>
        <li>
          <strong>Öncelik (küçük önce):</strong> Birden çok kural aynı işe uyuyorsa, küçük öncelikli
          olan önce uygulanır.
        </li>
        <li>
          <strong>Etki:</strong> Kuralın ne yaptığı — tür + değer (aşağıda).
        </li>
        <li>
          <strong>Koşullar:</strong> Kuralın hangi durumda uygulanacağı (aşağıda). Hiç koşul yoksa{" "}
          <strong>her zaman</strong> uygulanır.
        </li>
      </ul>

      <h2>Etki türleri</h2>
      <ul>
        <li>
          <strong>Kapasite × çarpan:</strong> Günlük montaj adedini çarpar. <em>0.8</em> = %20 azalt,{" "}
          <em>0.5</em> = yarıya indir, <em>1.2</em> = %20 artır. <strong>En sık kullanılan</strong>{" "}
          etki budur.
        </li>
        <li>
          <strong>Adet + ekle:</strong> Sabit bir miktar ekler/çıkarır (ör. <em>+1.5</em>).
        </li>
        <li>
          <strong>Efor × çarpan:</strong> Bir kapının “iş yükünü” çarpar. Efor artarsa günde daha az
          takılır (kapasiteyi düşürmenin başka bir yolu).
        </li>
      </ul>

      <h2>Koşullar (VE)</h2>
      <p>
        Bir kural, <strong>listelenen tüm koşullar aynı anda sağlanınca</strong> uygulanır. Her koşul
        üç parçadan oluşur: <strong>değişken</strong> · <strong>işlem</strong> · <strong>değer</strong>.
      </p>
      <p>Kullanılabilen değişkenlerden bazıları:</p>
      <ul>
        <li>
          <strong>line.leaf_width</strong> — kanat genişliği
        </li>
        <li>
          <strong>line.height</strong> — kapı yüksekliği
        </li>
        <li>
          <strong>line.area_m2</strong> — kapı alanı (m²)
        </li>
        <li>
          <strong>order.requires_demolition</strong> — işte kırım/sökme var mı (doğru/yanlış)
        </li>
        <li>
          <strong>team.headcount</strong> — ekipteki kişi sayısı
        </li>
        <li>
          <strong>day.overtime</strong> — o gün mesai mi (doğru/yanlış)
        </li>
      </ul>
      <p>
        İşlemler: <strong>=</strong>, <strong>≠</strong>, <strong>&gt;</strong>, <strong>≥</strong>,{" "}
        <strong>&lt;</strong>, <strong>≤</strong>. Değer bir sayı (ör. <em>2400</em>) veya doğru/yanlış
        (ör. <em>true</em>) olabilir.
      </p>

      <h2>Örnekler</h2>
      <ul>
        <li>
          <strong>Yüksek kapılar daha yavaş:</strong> Etki = <em>Kapasite × 0.8</em>, Koşul ={" "}
          <em>line.height &gt; 2400</em>. (2,4 m’den yüksek kapılarda kapasite %20 düşer.)
        </li>
        <li>
          <strong>Kırım olan işler yarı hız:</strong> Etki = <em>Kapasite × 0.5</em>, Koşul ={" "}
          <em>order.requires_demolition == true</em>.
        </li>
        <li>
          <strong>Her zaman geçerli temel kural:</strong> Hiç koşul eklemezseniz kural bütün işlere
          uygulanır.
        </li>
      </ul>

      <h2>Önemli notlar</h2>
      <ul>
        <li>
          Kurallar <strong>üst üste</strong> uygulanabilir: bir işe hem “büyük kanat” hem “kırım”
          kuralı uyuyorsa iki etki de birleşir (öncelik sırasıyla).
        </li>
        <li>
          Bir kuralı geçici kapatmak için silmek yerine <strong>Aktif</strong> işaretini kaldırın.
        </li>
        <li>
          Değişiklikten sonra etkiyi görmek için <strong>Planlama</strong> sayfasında{" "}
          <strong>“Yeniden Oluştur”</strong> demeniz gerekir.
        </li>
        <li>
          Emin değilseniz önce tek bir kuralı deneyin ve plandaki gün doluluklarının nasıl değiştiğini
          gözleyin.
        </li>
      </ul>
    </div>
  );
}
