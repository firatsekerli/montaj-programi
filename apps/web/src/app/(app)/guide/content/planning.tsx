/** Kullanma Kılavuzu — "Planlama" bölümü. */
export function PlanningGuide() {
  return (
    <div className="guide-content">
      <h2>Ne işe yarar?</h2>
      <p>
        <strong>Planlama</strong>, siparişlerin ekiplere ve günlere dağıtıldığı ana çalışma ekranıdır.
        Sistem, teslim tarihlerine ve kapasiteye göre otomatik bir plan üretir; siz de kartları
        sürükleyerek veya taşıyarak planı elle düzenleyebilirsiniz.
      </p>

      <h2>Panoyu okumak</h2>
      <p>
        Pano bir tablodur: <strong>satırlar ekipleri</strong>, <strong>sütunlar günleri</strong>{" "}
        gösterir (önceki Cmt–Pzr, Pzt–Cum ve sonraki Cmt–Pzr olmak üzere 9 gün; hafta sonları elle
        taşıma için dardır). Her hücrenin üstünde o günün <strong>doluluk yüzdesi</strong> ve bir
        dolum çubuğu vardır — %100 dolu bir gün demektir; üzeri aşırı yükü gösterir.
      </p>
      <p>Her kart bir işi temsil eder ve şunları gösterir:</p>
      <ul>
        <li>
          <strong>Sipariş No</strong> ve <strong>adet × kapı tipi</strong>.
        </li>
        <li>
          <strong>% gün:</strong> Bu kartın o günün kapasitesinin ne kadarını kapladığı.
        </li>
        <li>
          <strong>Gecikme</strong> rozeti (kırmızı): İş, siparişin teslim tarihinden sonraya
          planlandıysa.
        </li>
        <li>
          <strong>📌 (pin):</strong> Kart elle yerleştirilmiş ve yeniden oluşturmada korunuyor.
        </li>
      </ul>

      <h2>Plan oluşturma</h2>
      <ul>
        <li>
          <strong>Planı Oluştur / Yeniden Oluştur:</strong> Siparişleri (ve yaptığınız değişiklikleri)
          baz alarak planı hesaplar. Sipariş, kapasite, kural veya kapı tipi değiştirdiğinizde bunu
          çalıştırın.
        </li>
        <li>
          <strong>Temizle:</strong> Otomatik planı boşaltır. <strong>Takılan (tamamlanan) ve pinli
          kartlar korunur</strong> — yalnızca otomatik yerleştirilenler silinir.
        </li>
      </ul>
      <p>
        Üstteki <strong>Önceki hafta / Sonraki hafta</strong> ile haftalar arasında gezinirsiniz.
      </p>

      <h2>Kartları taşımak</h2>
      <ul>
        <li>
          <strong>Sürükle-bırak:</strong> Bir kartı başka bir ekip/gün hücresine sürükleyin.
        </li>
        <li>
          <strong>Taşı butonu:</strong> Karttaki <strong>“Taşı”</strong> ile ekip ve tarih seçerek
          taşıyın (başka haftaya bile).
        </li>
      </ul>
      <p>
        Elle taşıdığınız kart otomatik olarak <strong>pinlenir (📌)</strong>; böylece “Yeniden Oluştur”
        dediğinizde yerinde kalır. Pini kaldırmak için 📌 simgesine basın — o kart tekrar motorun
        planlamasına açılır.
      </p>

      <h3>Toplu taşıma</h3>
      <p>
        <strong>“Toplu Taşı”</strong> ile birden çok kartı seçip tek seferde bir ekip + tarihe
        taşıyabilirsiniz. Taşınan işler o tarihe ardışık yerleşir, diğer pinsiz işler kayar.
      </p>

      <h2>Montaj girişi (Takılanı gir)</h2>
      <p>
        Bir kart üzerindeki <strong>“Takılanı gir”</strong> ile o gün kaç kapının takıldığını
        kaydedersiniz:
      </p>
      <ul>
        <li>
          <strong>Takılan adet:</strong> O gün monte edilen sayı.
        </li>
        <li>
          <strong>Takan kişiler:</strong> Kapıları ekip dışında farklı kişiler taktıysa seçin. Boş
          bırakırsanız işi ekibin taktığı varsayılır.
        </li>
      </ul>
      <p>
        Adedin <strong>tamamı</strong> girilirse kart tamamlanır (yeşil, kilitli). <strong>Kısmi</strong>{" "}
        girerseniz (ör. 8’in 4’ü) kalan adet <strong>ertesi çalışma gününe</strong> aynı işin devamı
        olarak pinlenir ve diğer işler buna göre kaydırılır. Yanlış giriş için karttaki{" "}
        <strong>“Geri al”</strong> kullanılır — bu yalnızca o kartı düzeltir.
      </p>

      <h2>Notlar</h2>
      <p>
        Her kartta <strong>📝 Notlar</strong> vardır. Bir siparişe birden çok not eklenebilir; not{" "}
        <strong>tüm siparişe</strong> yazılır ve o siparişin her kartında görünür (iş birden çok güne
        bölünse bile). Notların yanındaki sayı, kaç not olduğunu gösterir.
      </p>

      <h2>Yazdır ve Dışa Aktar</h2>
      <ul>
        <li>
          <strong>Yazdır:</strong> Planı A4 yatay olarak yazdırır.
        </li>
        <li>
          <strong>Dışa Aktar:</strong> Seçtiğiniz tarih aralığında <strong>takılan</strong> kapıları
          Excel olarak indirir — hangi sipariş, hangi tarih, kim taktı. Boş bırakırsanız tümü aktarılır.
        </li>
      </ul>

      <h2>Planlanamayan siparişler</h2>
      <p>
        Bazı işler bu haftaya yerleştirilemezse pano altında <strong>“Planlanamayan siparişler”</strong>{" "}
        listelenir; her birinin yanında sebebi yazar:
      </p>
      <ul>
        <li>
          <strong>Ufuk dışında / üretim tarihi ileride:</strong> Üretim henüz hazır değil.
        </li>
        <li>
          <strong>Teslim tarihi geçmiş:</strong> Sipariş gecikmiş.
        </li>
        <li>
          <strong>Yetkin ekip yok:</strong> O kapı tipini yapabilecek ekip tanımlı değil.
        </li>
        <li>
          <strong>Kapasite yetmedi:</strong> Teslim tarihine yetişecek boş kapasite kalmadı.
        </li>
      </ul>

      <h2>Renk ve simge özeti</h2>
      <ul>
        <li>
          <strong>Yeşil kart:</strong> Takıldı (tamamlandı), kilitli.
        </li>
        <li>
          <strong>Kırmızı / Gecikme:</strong> Teslim tarihinden sonraya planlanmış iş.
        </li>
        <li>
          <strong>📌 pin:</strong> Elle yerleştirilmiş, yeniden oluşturmada korunuyor.
        </li>
        <li>
          <strong>Doluluk %:</strong> Günün ne kadar dolu olduğu; %100 üstü aşırı yük.
        </li>
      </ul>

      <h2>Önemli notlar</h2>
      <ul>
        <li>
          Takılan (tamamlanan) kartlar başka güne <strong>taşınamaz</strong> ve yeniden oluşturmada
          korunur.
        </li>
        <li>
          Geçmiş bir güne yeni iş planlanmaz; motor planlamaya <strong>bugünden</strong> başlar.
        </li>
        <li>
          Yaptığınız her elle taşıma, montaj girişi ve plan işlemi <strong>Geçmiş</strong> sayfasına
          kaydedilir.
        </li>
      </ul>
    </div>
  );
}
