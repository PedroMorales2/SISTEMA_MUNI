let tabla = document.getElementById("example");
let maple = document.getElementById("map");
const toggleDropdown = (dropdown, menu, isOpen) => {
  dropdown.classList.toggle("open", isOpen);
  menu.style.height = isOpen ? `${menu.scrollHeight}px` : 0;
};

// Close all open dropdowns
const closeAllDropdowns = () => {
  document
    .querySelectorAll(".dropdown-container.open")
    .forEach((openDropdown) => {
      toggleDropdown(
        openDropdown,
        openDropdown.querySelector(".dropdown-menu"),
        false
      );
    });
};

// Attach click event to all dropdown toggles
document.querySelectorAll(".dropdown-toggle").forEach((dropdownToggle) => {
  dropdownToggle.addEventListener("click", (e) => {
    e.preventDefault();
    const dropdown = dropdownToggle.closest(".dropdown-container");
    const menu = dropdown.querySelector(".dropdown-menu");
    const isOpen = dropdown.classList.contains("open");
    closeAllDropdowns(); // Close all open dropdowns
    toggleDropdown(dropdown, menu, !isOpen); // Toggle current dropdown visibility
  });
});

// Attach click event to sidebar toggle buttons
document
  .querySelectorAll(".sidebar-toggler, .sidebar-menu-button")
  .forEach((button) => {
    button.addEventListener("click", () => {
      closeAllDropdowns(); // Cerrar todos los dropdowns abiertos
      const sidebar = document.querySelector(".sidebar");
      const mainContent = document.querySelector(".main-content");

      // Alternar la clase 'collapsed' en el sidebar
      sidebar.classList.toggle("collapsed");

      // Alternar el margen del contenido principal cuando el sidebar se colapsa
      if (sidebar.classList.contains("collapsed")) {
        mainContent.style.marginLeft = "85px"; // El contenido principal se mueve a la izquierda
        // Ajustar este valor según el ancho del sidebar colapsado

        // mainContent.style.marginLeft = "0px"; // El contenido principal se mueve a la izquierda
        const titulo = document.getElementById("titulo_area");
        titulo.style.display = "none"; // Ocultar el título del área
      } else {
        mainContent.style.marginLeft = "270px"; // Ajustar este valor según el ancho del sidebar
        const titulo = document.getElementById("titulo_area");
        titulo.style.display = "block"; // Ocultar el título del área
      }

      // Forzar el redimensionamiento de la tabla
      if (tabla && $.fn.dataTable.isDataTable(tabla)) {
        $(tabla).DataTable().columns.adjust().draw();
      }

      // Simular un clic en la tabla (opcional)
      if (tabla) {
        tabla.click(); // Simula un clic en la tabla
      }
      
      if (maple) {
        // redimensionar con map box
        mapbox.resize();
      }
    });
  });


  


// Collapse sidebar by default on small screens
if (window.innerWidth <= 1024) {
  document.querySelector(".sidebar").classList.add("collapsed");
  document.querySelector(".main-content").style.marginLeft = "85px"; // Adjust the main content for mobile
}
